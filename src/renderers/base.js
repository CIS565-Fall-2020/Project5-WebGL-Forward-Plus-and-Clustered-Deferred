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

  clampSliceSpace(sliceSpace) {
    sliceSpace[0] = this.clampSlice(sliceSpace[0], this._xSlices);
    sliceSpace[1] = this.clampSlice(sliceSpace[1], this._ySlices);
    sliceSpace[2] = this.clampSlice(sliceSpace[2], this._zSlices);
  }

  floorSliceSpace(sliceSpace) {
    return vec3.fromValues(Math.floor(sliceSpace[0]), Math.floor(sliceSpace[1]), Math.floor(sliceSpace[2]))
  }

  getSliceSpaceFromWorldSpace(pos_worldSpace, cameraNear, inverseCameraFar , viewMatrix, projectionMatrix, dz) {
    var pos_camSpace = vec4.create();
    vec4.transformMat4(pos_camSpace, pos_worldSpace, viewMatrix);

    var pos_screenSpace = vec4.create();
    vec4.transformMat4(pos_screenSpace, pos_camSpace, projectionMatrix); // unhomogenized screen space 
    //vec4.scale(pos_screenSpace, pos_screenSpace, inverseCameraFar); // homogenized screen space (NDC)

    // NDC ranges from [-1, -1] to [1, 1] for both x and y direction
    // Want to normalize the space from [0, 0] to [1.1] by shifting the value by +1.0 then divide the value range (which is 2.0)
    // then find the slice that this is in by multiplying with the number of slices
    var pos_sliceSpace = vec3.fromValues(
      (pos_screenSpace[0] + 1.0) / 2.0 * this._xSlices,
      (pos_screenSpace[1] + 1.0) / 2.0 * this._ySlices,
      (pos_camSpace[2] - cameraNear) / dz
    );
    return pos_sliceSpace;
  }

  swapMinMaxVec3Component(componentIdx, min, max) {
    if (min[componentIdx] > max[componentIdx]) {
      var temp = max[componentIdx];
      max[componentIdx] = min[componentIdx];
      min[componentIdx] = temp;
    }
  }

  updateClusters(camera, viewMatrix, scene) {

    // DDEBUG ONLY TODO: DELETE
    // camera.far = 30.0;
    // camera.updateMatrixWorld();
    // camera.updateProjectionMatrix();
    var clusters = [];

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          clusters.push([]);
        }
      }
    }

    var projectionMatrix = mat4.create();
    mat4.copy(projectionMatrix, camera.projectionMatrix.elements);
    var dz = (camera.far - camera.near) / this._zSlices;  
    var inverseCameraFar = 1.0 / camera.far;

    for (let li_idx = 0; li_idx < scene.lights.length; li_idx++) {      
      // Transform the light position from world space to camera space
      var li = scene.lights[li_idx];
      var li_r = li.radius * 2;
      var li_posMinWorld = vec4.fromValues(li.position[0] - li_r, li.position[1] - li_r, li.position[2] - li_r, 1.0);
      var li_posMinSlice = this.getSliceSpaceFromWorldSpace(li_posMinWorld, camera.near, inverseCameraFar, viewMatrix, projectionMatrix, dz);
      li_posMinSlice = this.floorSliceSpace(li_posMinSlice);

      var li_posMaxWorld = vec4.fromValues(li.position[0] + li_r, li.position[1] + li_r, li.position[2] + li_r, 1.0);
      var li_posMaxSlice = this.getSliceSpaceFromWorldSpace(li_posMaxWorld, camera.near, inverseCameraFar, viewMatrix, projectionMatrix, dz);
      li_posMaxSlice = this.floorSliceSpace(li_posMaxSlice);

      // this.swapMinMaxVec3Component(0, li_posMinSlice, li_posMaxSlice);
      // this.swapMinMaxVec3Component(1, li_posMinSlice, li_posMaxSlice);
      // this.swapMinMaxVec3Component(2, li_posMinSlice, li_posMaxSlice);
      
      this.clampSliceSpace(li_posMinSlice);
      this.clampSliceSpace(li_posMaxSlice);
      
      if (li_posMaxSlice[0] < 0 || li_posMaxSlice[1] < 0 || li_posMaxSlice[2] < 0 ||
          li_posMinSlice[0] >= this._xSlices || li_posMinSlice[1] >= this._ySlices || li_posMinSlice[2] >= this._zSlices) {
        continue;
      }

      for (let z = li_posMinSlice[2]; z <= li_posMaxSlice[2]; ++z) {
        for (let y = li_posMinSlice[1]; y <= li_posMaxSlice[1]; ++y) {
          for (let x = li_posMinSlice[0]; x <= li_posMaxSlice[0]; ++x) {
            var clus_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var clus_liCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)];
            if (clus_liCount < MAX_LIGHTS_PER_CLUSTER) {
              clus_liCount += 1; // have to offset because first row first col is the light count
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)] = clus_liCount;
              var col  = Math.floor(clus_liCount % 4);
              var row = (clus_liCount - col) / 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , row) + col] = li_idx;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}