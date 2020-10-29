import { Math as threeMath, Vector4, Vector3 } from 'three';
import PerspectiveOffCenterFrustum from "cesium/Source/Core/PerspectiveOffCenterFrustum"
import BoundingSphere from "cesium/Source/Core/BoundingSphere"
import TextureBuffer from './textureBuffer';
import { Cartesian3, Cartesian4, PerspectiveFrustum } from 'cesium';
import { NUM_LIGHTS } from '../scene';
import Intersect from 'cesium/Source/Core/Intersect';
import {mat4, vec4} from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 300;

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
    
    var height = Math.tan(camera.fov * (Math.PI / 180.0) / 2.0)  * 2.0;
    var width = camera.aspect * height;

    for(let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++)
    {
      // Get light information
      var radius = scene.lights[lightIdx].radius;
      var lightPos = scene.lights[lightIdx].position;
      var lightInViewPos = vec4.fromValues(lightPos[0], lightPos[1], lightPos[2], 1.0);

      vec4.transformMat4(lightInViewPos, lightInViewPos, viewMatrix);
      lightInViewPos[2] *= -1.0;

      // Get strides for current light plane
      var xStride = width * lightInViewPos[2] / this._xSlices;
      var yStride = height * lightInViewPos[2] / this._ySlices;
      var zStride = (camera.far - camera.near) / this._zSlices;
      
      // Find ranges of different dimensions
      // 1. Z Planes
      let zMin = Math.max(Math.floor((lightInViewPos[2] - radius - camera.near) / zStride), 0);
      let zMax = Math.min(Math.floor((lightInViewPos[2] + radius - camera.near) / zStride), this._zSlices - 1);

      // 2. X Planes
      let xMin = Math.max(Math.floor((lightInViewPos[0] - radius + width * lightInViewPos[2] / 2.0) / xStride), 0);
      let xMax = Math.min(Math.floor((lightInViewPos[0] + radius + width * lightInViewPos[2] / 2.0) / xStride), 
                          this._xSlices - 1);

      // 3. Y Planes
      let yMin = Math.max(Math.floor((lightInViewPos[1] - radius + height * lightInViewPos[2] / 2.0) / yStride), 0);
      let yMax = Math.min(Math.floor((lightInViewPos[1] + radius + height * lightInViewPos[2] / 2.0) / yStride), 
                          this._ySlices - 1);

      
      // For giving range, set light information
      for(let z = zMin; z <= zMax; z++)
      {
        for(let y = yMin; y <= yMax; y++)
        {
          for(let x = xMin; x <= xMax; x++)
          {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var frustrumIdx = this._clusterTexture.bufferIndex(i, 0);
            var frustrumLightCnt = this._clusterTexture.buffer[frustrumIdx] + 1;

            if(frustrumLightCnt < MAX_LIGHTS_PER_CLUSTER)
            {
              var lightPixel = Math.floor(frustrumLightCnt / 4);
              var lightPixelElement = Math.floor(frustrumLightCnt % 4)
              this._clusterTexture.buffer[frustrumIdx] = frustrumLightCnt;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, lightPixel) + lightPixelElement] = lightIdx;
            }
          }
        }
      }
      
    }
    this._clusterTexture.update();
  }
}