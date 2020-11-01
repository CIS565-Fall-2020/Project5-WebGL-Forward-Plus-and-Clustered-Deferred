import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene.js';
import { vec3, vec4, mat4 } from 'gl-matrix';

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

    // compute height, width, depth of frustum
    let frustumDepth = camera.far - camera.near;
    let frustumHeight = 2 * Math.tan(camera.fov * 0.5 * Math.PI / 180);
    let frustumWidth = frustumHeight * camera.aspect;

    // compute height, width, depth of each cell
    let xStride = frustumWidth / this._xSlices;
    let yStride = frustumHeight / this._ySlices;
    let zStride = frustumDepth / this._zSlices;
    
    // for each light, get the position and radius,
    for (let i = 0; i < NUM_LIGHTS; ++i) {
      let light = scene.lights[i];
      let lightPosTmp = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      let radius = light.radius;

      let lightPos = vec4.create();
      vec4.transformMat4(lightPos, lightPosTmp, viewMatrix);

      let offset = radius * 0.25;

      let xMax = lightPos[0] + radius + offset;
      let xMin = lightPos[0] - radius - offset;
      let yMax = lightPos[1] + radius + offset;
      let yMin = lightPos[1] - radius - offset;
      let zMax = lightPos[2] + radius + offset;
      let zMin = lightPos[2] - radius - offset;

      let depth = Math.max(zMin, camera.near);
      let height = 2 * depth * Math.tan(camera.fov * 0.5 * Math.PI / 180);
      let width = height * camera.aspect;

      // for Z 
      let zMinIdx = Math.floor((zMin - camera.near) / zStride);
      zMinIdx = Math.max(zMinIdx, 0);
      zMinIdx = Math.min(zMinIdx, this._zSlices - 1);

      let zMaxIdx = Math.floor((zMax - camera.near) / zStride);
      zMaxIdx = Math.max(zMaxIdx, 0);
      zMaxIdx = Math.min(zMaxIdx, this._zSlices - 1);

      // for y
      let yMinIdx = Math.floor((yMin - (-1 * 0.5 * height)) / yStride);
      yMinIdx = Math.max(yMinIdx, 0);
      yMinIdx = Math.min(yMinIdx, this._ySlices - 1);  
      
      let yMaxIdx = Math.floor((yMax - (-1 * 0.5 * height)) / yStride);
      yMaxIdx = Math.max(yMaxIdx, 0);
      yMaxIdx = Math.min(yMaxIdx, this._ySlices - 1);   

      // for x
      let xMinIdx = Math.floor((xMin - (-1 * 0.5 * width)) / xStride);
      xMinIdx = Math.max(xMinIdx, 0);
      xMinIdx = Math.min(xMinIdx, this._xSlices - 1); 

      let xMaxIdx = Math.floor((xMax - (-1 * 0.5 * width)) / xStride);
      xMaxIdx = Math.max(xMaxIdx, 0);
      xMaxIdx = Math.min(xMaxIdx, this._xSlices - 1); 


      for (let z = zMinIdx; z <= zMaxIdx; ++z) {
        for (let y = yMinIdx; y <= yMaxIdx; ++y) {
          for (let x = xMinIdx; x <= xMaxIdx; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let lightCount = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];

            if(lightCount < MAX_LIGHTS_PER_CLUSTER) {
              lightCount++;
              let offset = lightCount % 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] = lightCount;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, Math.floor(lightCount / 4)) + offset] = i;
           }          
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}
