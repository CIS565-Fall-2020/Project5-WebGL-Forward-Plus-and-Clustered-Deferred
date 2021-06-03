import TextureBuffer from './textureBuffer';
import { mat4, vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;

function clampValue(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, view, viewProjectionMatrix, scene) {

    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    let inverseVP = mat4.create();
    mat4.invert(inverseVP, viewProjectionMatrix);

    let clusterLists = [];

    let cw = canvas.width,
        ch = canvas.height;

    let xSlices = this._xSlices,
        ySlices = this._ySlices,
        zSlices = this._zSlices;

    // Optimized: iterate over all lights and use their AABBs
    // to test less frustums
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          clusterLists[i] = [];
        }
      }
    }

    for(let l = 0; l < scene.lights.length; l++) {
      let currLight = scene.lights[l];
      let pos = currLight.position;
      let radius = currLight.radius + 5;
      // The bounding box is imperfect, so we need to give it some cushion

      // get the AABB in world space
      let world_min = vec4.fromValues(pos[0] - radius, pos[1] - radius, pos[2] - radius, 1);
       let   world_max = vec4.fromValues(pos[0] + radius, pos[1] + radius, pos[2] + radius, 1);

      // calculate z-slices in projected space
      let zDist = camera.far - camera.near;

      let camera_min = vec4.create();
      let camera_max = vec4.create();
      vec4.transformMat4(camera_min, world_min, view);
      vec4.transformMat4(camera_max, world_max, view);
	  
      let zMin = clampValue(Math.floor(camera_min[2] / zDist * zSlices), 0, zSlices);
      let zMax = clampValue(Math.ceil(camera_max[2] / zDist * zSlices), 0, zSlices);
      
      let trans_world_min = vec4.create();
      let trans_world_max = vec4.create();
      vec4.transformMat4(trans_world_min, world_min, viewProjectionMatrix);
      vec4.transformMat4(trans_world_max, world_max, viewProjectionMatrix);

      let xMin = (trans_world_min[0] + 1) / 2 * xSlices;
      let xMax = (trans_world_max[0] + 1) / 2 * xSlices;
      xMin = clampValue(Math.floor(xMin), 0, xSlices);
      xMax = clampValue(Math.ceil(xMax), 0, xSlices);

      let yMin = (trans_world_min[1] + 1) / 2 * ySlices;
      let yMax = (trans_world_max[1] + 1) / 2 * ySlices;

      yMin = clampValue(Math.floor(yMin), 0, ySlices);
      yMax = clampValue(Math.ceil(yMax), 0, ySlices);

      for (let z = zMin; z <= zMax; ++z) {
        for (let y = yMin; y <= yMax; ++y) {
          for (let x = xMin; x < xMax; ++x) {
            let i = x + y * xSlices + z * xSlices * ySlices;
            clusterLists[i].push(l);
          }
        }
      }
    }

    for(let i = 0; i < xSlices * ySlices * zSlices; i++) {
      if(clusterLists[i].length == 0) continue;
      let pixelNum = 0;
      let compNum = 1;
      let lights = clusterLists[i];
      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lights.length;
      for(let j = 0; j < lights.length; j++) {
        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, pixelNum) + compNum] = lights[j];
        compNum++;
        if(compNum >= 4) {
          compNum = 0;
          pixelNum++;
        }
      }
    }
    this._clusterTexture.update();
  }
}