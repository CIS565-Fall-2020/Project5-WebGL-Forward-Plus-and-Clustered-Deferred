import TextureBuffer from './textureBuffer';
import { mat4, vec2, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

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
    // Formulate a half angle fov vector subtended by the camera's fov.
    let fov = vec2.fromValues(camera.aspect * Math.tan(camera.fov * 0.5 * (Math.PI / 180.0)), Math.tan(camera.fov * 0.5 * (Math.PI / 180.0)));
    for (let i = 0; i < NUM_LIGHTS; ++i){
      let curr_light = scene.lights[i];
      let rad = curr_light.radius;
      // Find the current light in the camera's space
      let light_pos_4 = vec4.fromValues(curr_light.position[0], curr_light.position[1], curr_light.position[2], 1.0);
      vec4.transformMat4(light_pos_4, light_pos_4, viewMatrix);

      // Inverse the Z axis
      light_pos_4[2] = -light_pos_4[2];

      // Then we need to calculate the minimum bound that the current light is sitting at.
      let slice_w = 2.0 * fov[0] * light_pos_4[2];
      let slice_h = 2.0 * fov[1] * light_pos_4[2];
      // Z
      let deltaZ = (camera.far - camera.near) / this._zSlices;
      let z_a =  Math.floor((light_pos_4[2] - rad) / deltaZ);
      let z_b =  Math.floor((light_pos_4[2] + rad) / deltaZ);
      z_a = (z_a < 0) ? 0 : z_a;
      z_b = (z_b > this._zSlices - 1)? this._zSlices - 1 : z_b;

      // X
      let deltaX = slice_w / this._xSlices;
      let x_a = Math.floor((light_pos_4[0] + (slice_w / 2.0) - rad) / deltaX);
      let x_b = Math.floor((light_pos_4[0] + (slice_w / 2.0) + rad) / deltaX);
      x_a = (x_a < 0) ? 0 : x_a;
      x_b = (x_b > this._xSlices - 1)? this._xSlices - 1 : x_b;

      // Y
      let deltaY = slice_h / this._ySlices;
      let y_a = Math.floor((light_pos_4[1] + (slice_h / 2.0) - rad) / deltaY);
      let y_b = Math.floor((light_pos_4[1] + (slice_h / 2.0) + rad) / deltaY);
      y_a = (y_a < 0) ? 0 : y_a;
      y_b = (y_b > this._ySlices - 1)? this._ySlices - 1 : y_b;

      for (let z = z_a; z <= z_b; ++z){
        for (let y = y_a; y <= y_b; ++y){
          for (let x = x_a; x <= x_b; ++x){
            let index = x + y* this._xSlices + z * this._ySlices * this._xSlices;
            let light_index = this._clusterTexture.bufferIndex(index, 0);
            let num_lights = 1 + this._clusterTexture.buffer[light_index];

            if(num_lights <= MAX_LIGHTS_PER_CLUSTER){
              // Add the lights into the buffer
              let col = Math.floor(num_lights / 4);
              let row = Math.floor(num_lights % 4);  
              this._clusterTexture.buffer[light_index] = num_lights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, col) + row] = i;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}