import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import { Vector3 } from 'three';
import { PerspectiveOffCenterFrustum, Cartesian3, BoundingSphere, Intersect } from 'cesium';

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

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // create BoundingSphere for each light
    var spheres = [];
    for (let i = 0; i < NUM_LIGHTS; ++i) {
      let center = new Cartesian3(scene.lights[i].position[0], 
        scene.lights[i].position[1],
        scene.lights[i].position[2]);
      spheres.push(new BoundingSphere(center, scene.lights[i].radius));
    }
    // calculate frustrums
    var np_h = Math.tan(0.5 * camera.fov * Math.PI / 180.0) * camera.near;
    var np_w = np_h * camera.aspect;
    var dy = 2.0 * np_h / this._ySlices;
    var dx = 2.0 * np_w / this._xSlices;
    var dz = (camera.far - camera.near) / this._zSlices;
    var start_x = -1.0 * np_w;
    var start_y = -1.0 * np_h;
    var start_z = camera.near;
    var d_vec = new Vector3();
    camera.getWorldDirection(d_vec);
    var camera_dir = new Cartesian3(d_vec.x, d_vec.y, d_vec.z);

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          var frustrum = new PerspectiveOffCenterFrustum({
            left: start_x + x * dx,
            right: start_x + (x + 1) * dx,
            top: start_y + y * dy,
            bottom: start_y + (y + 1) * dy,
            near: start_z + z * dz,
            far: start_z + (z + 1) * dz
          });
          
          var cullingVolume = frustrum.computeCullingVolume(camera.position, camera_dir, camera.up);
          var count = 0;
          var indices = [];
          for (let k = 0; k < NUM_LIGHTS; ++k) {
            var intersect = cullingVolume.computeVisibility(spheres[k]);
            if (intersect != Intersect.OUTSIDE) {
              count = count + 1;
              indices.push(k);
            }
          }
          // update cluster buffer
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = count;
          for (let k = 1; k <= count; ++k) {
            let c = k % 4;
            let r = (k - c) / 4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, r) + c] = indices[k - 1]; 
          }
        }
      }
    }
    
    
    this._clusterTexture.update();
  }
}