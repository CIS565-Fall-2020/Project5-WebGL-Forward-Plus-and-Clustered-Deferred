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

  clampSliceSpace(sliceSpace) {
    sliceSpace[0] = Math.floor(Math.min(Math.max(sliceSpace[0], 0), this._xSlices - 1));
    sliceSpace[1] = Math.floor(Math.min(Math.max(sliceSpace[1], 0), this._ySlices - 1));
    sliceSpace[2] = Math.floor(Math.min(Math.max(sliceSpace[2], 0), this._zSlices - 1));
  }

  getSliceSpaceFromWorldSpace(pos_worldSpace, cameraNear, inverseCameraFar , viewMatrix, projectionMatrix, dz) {
    var pos_camSpace = vec4.create();
    vec4.transformMat4(pos_camSpace, pos_worldSpace, viewMatrix);

    var pos_screenSpace = vec4.create();
    vec4.transformMat4(pos_screenSpace, pos_camSpace, projectionMatrix); 

    // Ranges from [-1, -1] to [1, 1] for both x and y direction
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

  updateClusters(camera, viewMatrix, projectionMatrix, scene) {
    this.updateClusters1(camera, viewMatrix, projectionMatrix, scene);
  }

  updateClusters2(camera, viewMatrix, projectionMatrix, scene) {

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var tanAlpha = Math.tan(camera.fov * Math.PI / 180.0);
    var halfHeight = tanAlpha;
    var halfWidth = halfHeight * camera.aspect;
    var height = halfHeight * 2.0;
    var width = halfWidth * 2.0;
    var dz = (camera.far - camera.near) / this._zSlices;  
    
    for (let li_idx = 0; li_idx < scene.lights.length; li_idx++) {      
      // Transform the light position from world space to camera space
      var li = scene.lights[li_idx];
      var li_r = li.radius;
      var li_posMinWorld = vec4.fromValues(li.position[0] - li_r, li.position[1] - li_r, li.position[2] - li_r, 1.0);
      var li_posMinCam = vec4.create();
      vec4.transformMat4(li_posMinCam, li_posMinWorld, viewMatrix);
      var li_posMinSlice = vec3.create();
      li_posMinSlice[0] = (li_posMinCam[0] + halfWidth) / width * this._xSlices;
      li_posMinSlice[1] = (li_posMinCam[1] + halfHeight) / height * this._ySlices;
      li_posMinSlice[2] = li_posMinCam[2] / dz;

      var li_posMaxWorld = vec4.fromValues(li.position[0] + li_r, li.position[1] + li_r, li.position[2] + li_r, 1.0);
      var li_posMaxCam = vec4.create();
      vec4.transformMat4(li_posMaxCam, li_posMaxWorld, viewMatrix);
      var li_posMaxSlice = vec3.create();
      li_posMinSlice[0] = (li_posMaxCam[0] + halfWidth) / width * this._xSlices;
      li_posMinSlice[1] = (li_posMaxCam[1] + halfHeight) / height * this._ySlices;
      li_posMinSlice[2] = li_posMaxCam[2] / dz;

      this.swapMinMaxVec3Component(0, li_posMinSlice, li_posMaxSlice);
      this.swapMinMaxVec3Component(1, li_posMinSlice, li_posMaxSlice);
      this.swapMinMaxVec3Component(2, li_posMinSlice, li_posMaxSlice);
      
      this.clampSliceSpace(li_posMinSlice);
      this.clampSliceSpace(li_posMaxSlice);
      
      for (let z = li_posMinSlice[2]; z <= li_posMaxSlice[2]; ++z) {
        for (let y = li_posMinSlice[1]; y <= li_posMaxSlice[1]; ++y) {
          for (let x = li_posMinSlice[0]; x <= li_posMaxSlice[0]; ++x) {
            var clus_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var clus_liCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)];
            if (clus_liCount < MAX_LIGHTS_PER_CLUSTER) {
              clus_liCount += 1; // have to offset because first row first col is the light count
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)] = clus_liCount;
              var col  = clus_liCount % 4;
              var row = Math.floor(clus_liCount / 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , row) + col] = li_idx;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }

  updateClusters1(camera, viewMatrix, projectionMatrix, scene) {
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var dz = (camera.far - camera.near) / this._zSlices;  
    var inverseCameraFar = 1.0 / camera.far;

    for (let li_idx = 0; li_idx < scene.lights.length; li_idx++) {      
      // Transform the light position from world space to camera space
      var li = scene.lights[li_idx];
      var li_r = li.radius * 2;
      var li_posMinWorld = vec4.fromValues(li.position[0] - li_r, li.position[1] - li_r, li.position[2] - li_r, 1.0);
      var li_posMinSlice = this.getSliceSpaceFromWorldSpace(li_posMinWorld, camera.near, inverseCameraFar, viewMatrix, projectionMatrix, dz);

      var li_posMaxWorld = vec4.fromValues(li.position[0] + li_r, li.position[1] + li_r, li.position[2] + li_r, 1.0);
      var li_posMaxSlice = this.getSliceSpaceFromWorldSpace(li_posMaxWorld, camera.near, inverseCameraFar, viewMatrix, projectionMatrix, dz);

      this.swapMinMaxVec3Component(0, li_posMinSlice, li_posMaxSlice);
      this.swapMinMaxVec3Component(1, li_posMinSlice, li_posMaxSlice);
      this.swapMinMaxVec3Component(2, li_posMinSlice, li_posMaxSlice);
      
      this.clampSliceSpace(li_posMinSlice);
      this.clampSliceSpace(li_posMaxSlice);
      
      for (let z = li_posMinSlice[2]; z <= li_posMaxSlice[2]; ++z) {
        for (let y = li_posMinSlice[1]; y <= li_posMaxSlice[1]; ++y) {
          for (let x = li_posMinSlice[0]; x <= li_posMaxSlice[0]; ++x) {
            var clus_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var clus_liCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)];
            if (clus_liCount < MAX_LIGHTS_PER_CLUSTER) {
              clus_liCount += 1; // have to offset because first row first col is the light count
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , 0)] = clus_liCount;
              var col  = clus_liCount % 4;
              var row = Math.floor(clus_liCount / 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clus_idx , row) + col] = li_idx;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}