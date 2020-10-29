import TextureBuffer from './textureBuffer';
import { Vector3, Plane, Frustum, Sphere } from 'three';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...


    // get local coordinates from camera
    var look = new Vector3(0,0,-1);
    var up = new Vector3(0,1,0);
    var right = new Vector3(1,0,0);
    look.applyQuaternion(camera.quaternion).normalize();
    up.applyQuaternion(camera.quaternion).normalize();
    right.applyQuaternion(camera.quaternion).normalize();


    // get some constants ready for frustum search
    var numPlanesX = Math.floor(this._xSlices / 2);
    var numPlanesY = Math.floor(this._ySlices / 2);
    var numPlanesZ = this._zSlices;
    var maxDist = camera.far;
    var distSep = maxDist / numPlanesZ;
    
    // initialize some variables to prevent reinitializing three.js objects repeatedly
    var faces = [new Plane(), new Plane(), new Plane(), new Plane(), new Plane(), new Plane()]
    var frust = new Frustum();
    var sp = new Sphere();
    var tx = new Vector3();
    var ty = new Vector3();
    var ur = new Vector3();
    var lr = new Vector3();
    var ll = new Vector3();
    var ul = new Vector3();
    var bur = new Vector3();
    var blr = new Vector3();
    var bll = new Vector3();
    var bul = new Vector3();
    var centroid = new Vector3();

    var blockSize = distSep;
    for(var k = 0; k < numPlanesZ; k++) {
      var d = camera.near + (k * distSep);
      var frustumHeight = 2.0 * d * Math.tan(camera.fov * 0.5 * (Math.PI/180)) * 0.5;
      var frustumWidth = frustumHeight * camera.aspect;
      var bfrustumHeight = 2.0 * (d+blockSize) * Math.tan(camera.fov * 0.5 * (Math.PI/180)) * 0.5;
      var bfrustumWidth = bfrustumHeight * camera.aspect;

      for(var i = -numPlanesX; i < numPlanesX; i++) {
        for(var j = -numPlanesY; j < numPlanesY; j++) {
          let bufferIdx = (i+numPlanesX) + ((j+numPlanesY) * this._xSlices) + (k * this._xSlices * this._ySlices);

          // Front Face
          tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i+1)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j+1)/numPlanesY);
          ur = ur.copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);
        
          tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i+1)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j)/numPlanesY);
          lr = lr.copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);
        
          tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j)/numPlanesY);
          ll = ll.copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);
        
          tx = tx.copy(right).multiplyScalar(frustumWidth).multiplyScalar((i)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(frustumHeight).multiplyScalar((j+1)/numPlanesY);
          ul = ul.copy(look).multiplyScalar(d).add(camera.position).add(tx).add(ty);

          // Back Face
          tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i+1)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j+1)/numPlanesY);
          bur = bur.copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
        
          tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i+1)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j)/numPlanesY);
          blr = blr.copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
        
          tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j)/numPlanesY);
          bll = bll.copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
        
          tx = tx.copy(right).multiplyScalar(bfrustumWidth).multiplyScalar((i)/numPlanesX);
          ty = ty.copy(up).multiplyScalar(bfrustumHeight).multiplyScalar((j+1)/numPlanesY);
          bul = bul.copy(look).multiplyScalar(d+blockSize).add(camera.position).add(tx).add(ty);
          

          faces[0].setFromCoplanarPoints(ur, lr, ll);
          faces[1].setFromCoplanarPoints(blr, bur, bll);
          faces[2].setFromCoplanarPoints(ul, ll, bll);
          faces[3].setFromCoplanarPoints(lr, ur, blr);
          faces[4].setFromCoplanarPoints(ur, ul, bur);
          faces[5].setFromCoplanarPoints(ll, lr, blr);

          frust.set(faces[0], faces[1], faces[2], faces[3], faces[4], faces[5])
          sp.set(tx, 1);

          var lightCount = 0;
          for(var lightIdx = 0; lightIdx < scene.lights.length; lightIdx++) {
            var lightpos = scene.lights[lightIdx]["position"];
            centroid.set(lightpos[0], lightpos[1], lightpos[2]);
            sp.set(centroid, scene.lights[lightIdx]["radius"])
            if (frust.intersectsSphere(sp)) {
              lightCount++;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, Math.floor(lightCount / 4)) + lightCount % 4] = lightIdx;
              if (lightCount == MAX_LIGHTS_PER_CLUSTER) {
                break;
              }
            }
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, 0)] = lightCount;
        }
      }
    }
    this._clusterTexture.update();
  }
}