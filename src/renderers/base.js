import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene.js';
import { vec4 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 300;


const getSliceIndex = (value, min, max, numSlices) => {
  const stride = (max - min) / numSlices;
  const index = Math.floor((value - min) / stride)
  return index < 0 ? 0 : index >= numSlices ? numSlices - 1 : index;
};

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
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


    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
      const light = scene.lights[lightIdx];

      const lightWorldPos = vec4.fromValues(
        light.position[0],
        light.position[1],
        light.position[2],
        1.0
      );

      const lightCameraPos = vec4.create();
      vec4.transformMat4(lightCameraPos, lightWorldPos, viewMatrix);

      const lightX = lightCameraPos[0],
            lightY = lightCameraPos[1],
            lightZ = -lightCameraPos[2];

      const offsetRadius = light.radius * 1.2;
      const maxZ = lightZ + offsetRadius,
            minZ = lightZ - offsetRadius;
      const maxX = lightX + offsetRadius,
            minX = lightX - offsetRadius;
      const maxY = lightY + offsetRadius,
            minY = lightY - offsetRadius;

      const frustumZ = Math.max(minZ, camera.near); 
      const yRange = frustumZ * Math.tan(camera.fov * 0.5 * (Math.PI / 180));
      const xRange = yRange * camera.aspect;

      const minClusterZidx = Math.max(getSliceIndex(minZ, camera.near, camera.far, this._zSlices), 0),
            maxClusterZidx = Math.min(getSliceIndex(maxZ, camera.near, camera.far, this._zSlices), this._zSlices - 1),
            minClusterXidx = Math.max(getSliceIndex(minX, -xRange, xRange, this._xSlices), 0),
            maxClusterXidx = Math.min(getSliceIndex(maxX, -xRange, xRange, this._xSlices), this._xSlices - 1),
            minClusterYidx = Math.max(getSliceIndex(minY, -yRange, yRange, this._ySlices), 0),
            maxClusterYidx = Math.min(getSliceIndex(maxY, -yRange, yRange, this._ySlices), this._ySlices - 1);

      for (let z = minClusterZidx; z <= maxClusterZidx; z++) {
        for (let y = minClusterYidx; y <= maxClusterYidx; y++) {
          for (let x = minClusterXidx; x <= maxClusterXidx; x++) {
            const i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            count++;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            const component = Math.floor(count / 4);
            const offset = count - component * 4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = count;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, component) + offset] = lightIdx;
          }
        }
      }

    }


    this._clusterTexture.update();
  }
}