import TextureBuffer from './textureBuffer';
import {NUM_LIGHTS} from '../scene.js'
import {vec4, mat4} from 'gl-matrix';

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

    let screenH = 2.0 * Math.tan(camera.fov * (Math.PI / 180.0) / 2.0);
	let screenW = camera.aspect * screenH;	
	let depth = camera.far - camera.near;

	  for (let idx = 0; idx < NUM_LIGHTS; idx++) {
		  let light = scene.lights[idx];
		  let light_pos = vec4.fromValues(light.position[0], light.position[1], light.position[2]);
		  vec4.transformMat4(light_pos, light_pos, viewMatrix);
		  light_pos[2] = - light_pos[2];

		  let light_pos_x = light_pos[0];
		  let light_pos_y = light_pos[1];
		  let light_pos_z = light_pos[2];
		  let stepX = screenW * light_pos[2] / this._xSlices;
		  let stepY = screenH * light_pos[2] / this._ySlices;
		  let stepZ = depth / this._zSlices;

		  let minX = - screenW * light_pos[2] / 2.0;
		  let minY = - screenH * light_pos[2] / 2.0;

		  let radius = light.radius;
		  let startX = Math.floor((light_pos_x - radius - minX) / stepX);
		  let endX = Math.floor((light_pos_x + radius - minX) / stepX);
		  let startY = Math.floor((light_pos_y - radius - minY) / stepY);
		  let endY = Math.floor((light_pos_y + radius - minY) / stepY);
		  let startZ = Math.floor((light_pos_z - radius - camera.near) / stepZ);
		  let endZ = Math.floor((light_pos_z + radius - camera.near) / stepZ);

		  startX = Math.min(Math.max(0.0, startX), this._xSlices - 1);
		  endX = Math.min(Math.max(0.0, endX), this._xSlices - 1);
		  startY = Math.min(Math.max(0.0, startY), this._ySlices - 1);
		  endY = Math.min(Math.max(0.0, endY), this._ySlices - 1);
		  startZ = Math.min(Math.max(0.0, startZ), this._zSlices - 1);
		  endZ = Math.min(Math.max(0.0, endZ), this._zSlices - 1);

		  for (let z = startZ; z < endZ; z++) {
			  for (let y = startY; y < endY; y++) {
				  for (let x = startX; x < endX; x++) {
					  let clustIdx = x + y * this._xSlices + z * this._ySlices * this._xSlices;
					  let bufferIdx = this._clusterTexture.bufferIndex(clustIdx, 0);
					  let lightNum = this._clusterTexture.buffer[bufferIdx];

					  if (lightNum < MAX_LIGHTS_PER_CLUSTER) {
						  this._clusterTexture.buffer[bufferIdx] = lightNum + 1;
						  let lightIdx = this._clusterTexture.bufferIndex(clustIdx, Math.floor(lightNum / 4)) + Math.floor(lightNum % 4);
						  this._clusterTexture.buffer[lightIdx] = idx;
					  }
				  }
			  }
		  }
	  }

    this._clusterTexture.update();
  }
}