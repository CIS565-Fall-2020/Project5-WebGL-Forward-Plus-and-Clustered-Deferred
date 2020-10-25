import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene.js';
import { mat4, vec4 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;
// export const MAX_LIGHTS_PER_CLUSTER = 0;

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
    
    // screenH and screeW are height and width at z = 1
    let screenH = Math.tan(camera.fov * (Math.PI / 180.0) / 2.0) * 2.0;
    let screenW = camera.aspect * screenH;
    let screenDepth = camera.far - camera.near;

    for(let light_idx = 0; light_idx < NUM_LIGHTS; light_idx++){
      let light = scene.lights[light_idx];
      let radius = light.radius;
      let light_world_pos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      let light_cameraspace_pos = vec4.create();
      vec4.transformMat4(light_cameraspace_pos, light_world_pos, viewMatrix);
      light_cameraspace_pos[2] *= -1.0;

      // Get slice strides in each dim
      let x_slice_length = screenW * light_cameraspace_pos[2];
      let y_slice_length = screenH * light_cameraspace_pos[2];
      let x_stride = x_slice_length / this._xSlices;
      let y_stride = y_slice_length / this._ySlices;
      let z_stride = screenDepth / this._zSlices;

      // Find start and end slices this light has impart on
      let x_slice_min = - x_slice_length / 2.0;
      let y_slice_min = - y_slice_length / 2.0;
      let x_start_idx = Math.floor((light_cameraspace_pos[0] - radius - x_slice_min) / x_stride);
      let y_start_idx = Math.floor((light_cameraspace_pos[1] - radius - y_slice_min) / y_stride);
      let z_start_idx = Math.floor((light_cameraspace_pos[2] - radius - camera.near) / z_stride);
      let x_end_idx = Math.floor((light_cameraspace_pos[0] + radius - x_slice_min) / x_stride);
      let y_end_idx = Math.floor((light_cameraspace_pos[1] + radius - y_slice_min) / y_stride);
      let z_end_idx = Math.floor((light_cameraspace_pos[2] + radius - camera.near) / z_stride);

      // Clamp the start and end indices
      x_start_idx = Math.min(Math.max(x_start_idx, 0), this._xSlices - 1);
      y_start_idx = Math.min(Math.max(y_start_idx, 0), this._ySlices - 1);
      z_start_idx = Math.min(Math.max(z_start_idx, 0), this._zSlices - 1);
      x_end_idx = Math.min(Math.max(x_end_idx, 0), this._xSlices - 1);
      y_end_idx = Math.min(Math.max(y_end_idx, 0), this._ySlices - 1);
      z_end_idx = Math.min(Math.max(z_end_idx, 0), this._zSlices - 1);
      
      // Put this light to the cluster
      for(let z = z_start_idx; z <= z_end_idx; ++z){
        for(let y = y_start_idx; y <= y_end_idx; ++y){
          for(let x = x_start_idx; x <= x_end_idx; ++x){
            // this._clusterTexture.buffer[this._clusterTexture.bufferIndex(0, 0)] = 1;
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let buffer_idx = this._clusterTexture.bufferIndex(i, 0);
            let curr_light_num = this._clusterTexture.buffer[buffer_idx];
            if(curr_light_num < MAX_LIGHTS_PER_CLUSTER)
            {
              // Update total light num
              this._clusterTexture.buffer[buffer_idx] = curr_light_num + 1;
              curr_light_num += 1;
              // Update light map -- it is a stack like data structure for each element
              let light_map_idx = this._clusterTexture.bufferIndex(i, Math.floor(curr_light_num/4)) + Math.floor(curr_light_num%4);
              this._clusterTexture.buffer[light_map_idx] = light_idx;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
    
    /*
    for(let lightIdx = 0; lightIdx < NUM_LIGHTS; ++lightIdx){
      let light = scene.light[lightIdx];
      let light_world_pos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);

      let light_cameraspace_pos = vec4.create();
      vec4.transformMat4(light_cameraspace_pos, light_world_pos, viewMatrix);

      let light_x = light_cameraspace_pos[0];
      let light_y = light_cameraspace_pos[1];
      let light_z = light_cameraspace_pos[2];

      let light_z_min = light_z - light.radius;
      let light_z_max = light_z + light.radius;
    }
    */
    
  }
}