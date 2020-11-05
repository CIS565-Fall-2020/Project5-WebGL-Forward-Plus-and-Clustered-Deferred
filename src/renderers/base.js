import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { str, vec4 } from 'gl-matrix';
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
    // Update the cluster texture with the count and indices of the lights in each cluster

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    const halfFovY = Math.tan(camera.fov * Math.PI / 360.0);
    const halfFovX = camera.aspect * halfFovY;
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++)
    {
      const light = scene.lights[lightIdx];
      const lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      
      // Convert coord from world space to camera view space
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      // The front direction of camera is negative z
      lightPos[2] *= -1.0;

      // Compute the cluster's range in Z coordinate [minZ, maxZ] 
      const depth = lightPos[2];
      const clusterLengthInZ = (camera.far - camera.near) / this._zSlices;
      let maxZ = Math.floor((depth - camera.near + light.radius) / clusterLengthInZ);
      let minZ = Math.floor((depth - camera.near - light.radius) / clusterLengthInZ);
      maxZ = Math.min(maxZ, this._zSlices - 1);
      minZ = Math.max(minZ, 0);

      // Compute the cluster's range in X coordinate [minX, maxX] 
      const halfWidth = halfFovX * depth;
      const clusterLengthInX = 2 * halfWidth / this._xSlices;
      let maxX = Math.floor((halfWidth + lightPos[0] + light.radius) / clusterLengthInX);
      let minX = Math.floor((halfWidth + lightPos[0] - light.radius) / clusterLengthInX);
      maxX = Math.min(maxX, this._xSlices - 1);
      minX = Math.max(minX, 0);

      // Compute the cluster's range in Y coordinate [minY, maxY]
      const halfHeight = halfFovY * depth;
      const clusterLengthInY = 2 * halfHeight / this._ySlices;
      let maxY = Math.floor((halfHeight + lightPos[1] + light.radius) / clusterLengthInY);
      let minY = Math.floor((halfHeight + lightPos[1] - light.radius) / clusterLengthInY);
      maxY = Math.min(maxY, this._ySlices - 1);
      minY = Math.max(minY, 0);

      // Update information about lights influencing the current clusters
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let numLightsInCurCluster = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] + 1;

            if (numLightsInCurCluster > MAX_LIGHTS_PER_CLUSTER)
              continue;
            
            let componentIdx = Math.floor(numLightsInCurCluster / 4);
            let elementIdxInComponent = Math.floor(numLightsInCurCluster % 4);
            // The 0-th float of an element represents the number of lights influencing the current cluster
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = numLightsInCurCluster;
            // Use componentIdx and elementIdxInComponent to set the current light in the particular slot
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, componentIdx) + elementIdxInComponent] = lightIdx;
          }
        }
      }
    }
    
    this._clusterTexture.update();
  }
}