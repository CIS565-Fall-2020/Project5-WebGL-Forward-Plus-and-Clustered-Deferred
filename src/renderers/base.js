import { MaxEquation } from 'three';
import Wireframe from '../wireframe';
import TextureBuffer from './textureBuffer';
import { gl } from '../init';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import {Plane, Sphere, Frustum, Vector3, Vector4} from 'three'

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene, wireframe, a) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    var far = camera.far;
    var near = camera.near;
    var hfov = camera.fov / 2;

    // var ltWSpacen = vec4.create();
    // var rtWSpacen = vec4.create();
    // var lbWSpacen = vec4.create();
    // var rbWSpacen = vec4.create();
    // var ltWSpacef = vec4.create();
    // var rtWSpacef = vec4.create();
    // var lbWSpacef = vec4.create();
    // var rbWSpacef = vec4.create();

    var invertViewMtx = mat4.create();
    mat4.copy(invertViewMtx, camera.matrixWorld.elements);

    for (let z = 0; z < this._zSlices; ++z) {
      let tempzn = near + z * (far - near) / this._zSlices; // old
      let tempzf = tempzn + (far - near) / this._zSlices;

      let halfHn = Math.tan(hfov * Math.PI / 180) * tempzn;
      let halfWn = camera.aspect * halfHn;
      let halfHf = Math.tan(hfov * Math.PI / 180) * tempzf;
      let halfWf = camera.aspect * halfHf;

      let ltn = new Vector4(-halfWn, halfHn, -tempzn, 1);
      let ltf = new Vector4(-halfWf, halfHf, -tempzf, 1);

      let ystepf = (2 * halfHf) / this._ySlices;
      let ystepn = (2 * halfHn) / this._ySlices;
      let xstepf = (2 * halfWf) / this._xSlices;
      let xstepn = (2 * halfWn) / this._xSlices;

      for (let y = 0; y < this._ySlices; ++y) {
        let yoffsetft = y * ystepf;
        let yoffsetfb = (y+1) * ystepf;
        let yoffsetnt = y * ystepn;
        let yoffsetnb = (y+1) * ystepn;
        
        for (let x = 0; x < this._xSlices; ++x) {

          let xOffsetlf = x * xstepf;
          let xOffsetln = x * xstepn;
          let xOffsetrf = (x+1) * xstepf;
          let xOffsetrn = (x+1) * xstepn;

          // let xltf = new Vector3(ltf.x + xOffsetlf, ltf.y - yoffsetft, ltf.z);
          // let xlbf = new Vector3(ltf.x + xOffsetlf, ltf.y - yoffsetfb, ltf.z);
          // let xrtf = new Vector3(ltf.x + xOffsetrf, ltf.y - yoffsetft, ltf.z);
          let xrbf = new Vector3(ltf.x + xOffsetrf, ltf.y - yoffsetfb, ltf.z); // pivot
          let xltn = new Vector3(ltn.x + xOffsetln, ltn.y - yoffsetnt, ltn.z); // pivot
          // let xlbn = new Vector3(ltn.x + xOffsetln, ltn.y - yoffsetnb, ltn.z);
          // let xrtn = new Vector3(ltn.x + xOffsetrn, ltn.y - yoffsetnt, ltn.z);
          // let xrbn = new Vector3(ltn.x + xOffsetrn, ltn.y - yoffsetnb, ltn.z);

          let A = new Vector3((ltf.x + xOffsetlf) - xltn.x, (ltf.y - yoffsetft) - xltn.y, ltf.z - ltn.z);
          let B = new Vector3((ltn.x + xOffsetrn) - xltn.x, (ltn.y - yoffsetnt) - xltn.y, 0);
          let C = new Vector3((ltn.x + xOffsetln) - xltn.x, (ltn.y - yoffsetnb) - xltn.y, 0)

          let D = new Vector3((ltf.x + xOffsetrf) - xrbf.x, (ltf.y - yoffsetft) - xrbf.y, 0);
          let E = new Vector3((ltf.x + xOffsetlf) - xrbf.x, (ltf.y - yoffsetfb) - xrbf.y, 0);
          let F = new Vector3((ltn.x + xOffsetrn) - xrbf.x, (ltn.y - yoffsetnb) - xrbf.y, ltn.z - ltf.z);
          
          
          // let xltf2 = vec4.fromValues(xltf.x, xltf.y, xltf.z, 1);
          // let xrtf2 = vec4.fromValues(xrtf.x, xrtf.y, xrtf.z, 1);
          // let xlbf2 = vec4.fromValues(xlbf.x, xlbf.y, xlbf.z, 1);
          // let xrbf2 = vec4.fromValues(xrbf.x, xrbf.y, xrbf.z, 1);
          // let xltn2 = vec4.fromValues(xltn.x, xltn.y, xltn.z, 1);
          // let xrtn2 = vec4.fromValues(xrtn.x, xrtn.y, xrtn.z, 1);
          // let xlbn2 = vec4.fromValues(xlbn.x, xlbn.y, xlbn.z, 1);
          // let xrbn2 = vec4.fromValues(xrbn.x, xrbn.y, xrbn.z, 1);

          // vec4.transformMat4(ltWSpacef, xltf2, invertViewMtx);
          // vec4.transformMat4(rtWSpacef, xrtf2, invertViewMtx);
          // vec4.transformMat4(lbWSpacef, xlbf2, invertViewMtx);
          // vec4.transformMat4(rbWSpacef, xrbf2, invertViewMtx);

          // vec4.transformMat4(ltWSpacen, xltn2, invertViewMtx);
          // vec4.transformMat4(rtWSpacen, xrtn2, invertViewMtx);
          // vec4.transformMat4(lbWSpacen, xlbn2, invertViewMtx);
          // vec4.transformMat4(rbWSpacen, xrbn2, invertViewMtx);

          // var ltn2 = [ltWSpacen[0], ltWSpacen[1], ltWSpacen[2]];
          // var rtn2 = [rtWSpacen[0], rtWSpacen[1], rtWSpacen[2]];
          // var lbn2 = [lbWSpacen[0], lbWSpacen[1], lbWSpacen[2]];
          // var rbn2 = [rbWSpacen[0], rbWSpacen[1], rbWSpacen[2]];
          // var ltf2 = [ltWSpacef[0], ltWSpacef[1], ltWSpacef[2]];
          // var rtf2 = [rtWSpacef[0], rtWSpacef[1], rtWSpacef[2]];
          // var lbf2 = [lbWSpacef[0], lbWSpacef[1], lbWSpacef[2]];
          // var rbf2 = [rbWSpacef[0], rbWSpacef[1], rbWSpacef[2]];

          // var segcolor = [1,1,1];
          // if (x % 2 == 0) {
          //   segcolor = [1,1,1];
          // } else {
          //   segcolor = [1,0.6,1];
          // }
          
          // if (a == 0) {
          //   wireframe.addLineSegment(ltn2, rtn2, segcolor);
          //   wireframe.addLineSegment(rtn2, rbn2, segcolor);
          //   wireframe.addLineSegment(rbn2, lbn2, segcolor);
          //   wireframe.addLineSegment(lbn2, ltn2, segcolor);
    
          //   wireframe.addLineSegment(ltf2, rtf2, segcolor);
          //   wireframe.addLineSegment(rtf2, rbf2, segcolor);
          //   wireframe.addLineSegment(rbf2, lbf2, segcolor);
          //   wireframe.addLineSegment(lbf2, ltf2, segcolor);
    
          //   wireframe.addLineSegment(ltn2, ltf2, segcolor);
          //   wireframe.addLineSegment(rtn2, rtf2, segcolor);
          //   wireframe.addLineSegment(lbn2, lbf2, segcolor);
          //   wireframe.addLineSegment(rbn2, rbf2, segcolor);
          // }
            

          // up Plane
          let upNorm = A.clone().cross(B).normalize();
          let upPlane = new Plane(upNorm, 0);

          // left Plane
          var leftNorm = C.clone().cross(A).normalize();
          var leftPlane = new Plane(leftNorm, 0);
          
          // bot Plane
          var botNorm = E.clone().cross(F).normalize();
          var botPlane = new Plane(botNorm, 0);

          // right Plane
          var rightNorm = F.clone().cross(D).normalize();
          var rightPlane = new Plane(rightNorm, 0);

          // far Plane
          var farNorm = D.clone().cross(E).normalize();
          let farDist = xrbf.clone().multiplyScalar(-1.0).dot(farNorm);
          var farPlane = new Plane(farNorm, farDist);

          // near Plane
          var nearNorm = B.clone().cross(C).normalize();
          let nearDist = xltn.clone().multiplyScalar(-1.0).dot(nearNorm);
          var nearPlane = new Plane(nearNorm, nearDist);

          // create frustum
          var frustum = new Frustum(upPlane, leftPlane, botPlane, rightPlane, farPlane, nearPlane);
          

          // next step is to find out which lights are in this frustum
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          var count = 0;
          let buffIter = 1;
          for (let li = 0; li < NUM_LIGHTS; li++) {
            var light = scene.lights[li];
            var lightWorldPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
            var lightCamPos = vec4.create();
            vec4.transformMat4(lightCamPos, lightWorldPos, viewMatrix);
            var radius = light.radius;
            var center = new Vector3(lightCamPos[0], lightCamPos[1], lightCamPos[2]);
            var lightsphere = new Sphere(center, radius);
            
            var containsLight = (frustum.containsPoint(center) || frustum.intersectsSphere(lightsphere));
            if (containsLight) {
            // if (true){
              let mod = buffIter % 4;
              let row = Math.floor(buffIter / 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, row) + mod] = li;
              count++;
              buffIter++;
            }
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = count;
          
        }
      }
    }

    this._clusterTexture.update();
  }
}