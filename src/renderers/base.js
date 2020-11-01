import TextureBuffer from './textureBuffer';

import { Frustum, Plane, Vector2, Vector3 } from '../../node_modules/three/build/three'
import { mat2, projection, vec2 } from 'gl-matrix';
import { mat3, vec3 } from 'gl-matrix';
import { mat4, vec4 } from 'gl-matrix';
import { Sphere } from '../../node_modules/three/build/three'

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._firstCall = true;
  }

  clampSlice(sliceValue, numSlices) {
    return Math.min(Math.max(sliceValue, 0), numSlices - 1);
  }

  updateClusters(camera, viewMatrix, scene) {
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    
    var tanAlpha2 = 2.0 * Math.tan((camera.fov / 2.0 * Math.PI / 180.0));
    var clus_perDim = vec3.create();
    clus_perDim[0] = tanAlpha2 / this._xSlices;
    clus_perDim[1] = tanAlpha2 * camera.aspect / this._ySlices;
    clus_perDim[2] = (camera.far - camera.near) / this._zSlices;

    for (let li_idx = 0; li_idx < scene.lights.length; li_idx++) {
      // Transform the light position from world space to camera space
      var li = scene.lights[li_idx];
      var li_posWorld = vec4.fromValues(li.position[0], li.position[1], li.position[2], 1.0);
      var li_posCam = vec4.create();
      vec4.transformMat4(li_posCam, li_posWorld, viewMatrix);
      
      var clus_idxMin = vec3.create();
      clus_idxMin[0] = Math.floor(this.clampSlice((li_posCam[0] - li.radius) / clus_perDim[0], this._xSlices));
      clus_idxMin[1] = Math.floor(this.clampSlice((li_posCam[1] - li.radius) / clus_perDim[1], this._ySlices));
      clus_idxMin[2] = Math.floor(this.clampSlice((li_posCam[2] - li.radius) / clus_perDim[2], this._zSlices));
      
      var clus_idxMax = vec3.create();
      clus_idxMax[0] = Math.floor(this.clampSlice((li_posCam[0] + li.radius) / clus_perDim[0], this._xSlices));
      clus_idxMax[1] = Math.floor(this.clampSlice((li_posCam[1] + li.radius) / clus_perDim[1], this._ySlices));
      clus_idxMax[2] = Math.floor(this.clampSlice((li_posCam[2] + li.radius) / clus_perDim[2], this._zSlices));
      
      for (let z = clus_idxMin[2]; z <= clus_idxMax[2]; ++z) {
        for (let y = clus_idxMin[1]; y <= clus_idxMax[1]; ++y) {
          for (let x = clus_idxMin[0]; x <= clus_idxMax[0]; ++x) {
            var clus_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var clus_liCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)];
            if (clus_liCount < MAX_LIGHTS_PER_CLUSTER) {
              clus_liCount += 1; // have to offset because first row first col is the light count
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)] = clus_liCount;
              var row = Math.floor(clus_liCount / 4.0);
              var col  = Math.floor(clus_liCount % 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , row) + col] = li_idx;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}