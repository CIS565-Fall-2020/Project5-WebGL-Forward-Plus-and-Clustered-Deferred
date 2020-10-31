import { mat4, vec4, vec3 } from 'gl-matrix';
import { Vector3, Vector4 } from 'three';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';


export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    //this._MaxLightsPerCluster = MaxLightsPerCluster + 1;
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
    let lights = scene.lights;

    // Calculate screen width and height at near and far clip
    var near_height = 2 * camera.near * Math.tan(camera.fov * 0.5 * Math.PI/180.0);
    var near_width  = camera.aspect * near_height;
  
    var far_height = 2 * camera.far * Math.tan(camera.fov * 0.5 * Math.PI/180.0);
    var far_width  = camera.aspect * far_height;

    let step_z = (camera.far - camera.near) / (1.0 * this._zSlices);


    for(let l = 0; l < NUM_LIGHTS; l++) {
      // Get light info
      let light = lights[l];
      let light_pos_world = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
      let light_pos_view = vec4.create();
      mat4.multiply(light_pos_view, viewMatrix, light_pos_world);
      light_pos_view[2] *= -1.0;
      let light_radius = light.radius;

      // Find the range of grids in z/depth direction     
      let min_z_grid = Math.floor((light_pos_view[2] - light_radius - camera.near) / step_z);
      let max_z_grid = Math.ceil(((light_pos_view[2] + light_radius - camera.near) / step_z));

      min_z_grid = Math.min(Math.max(min_z_grid, 0), this._zSlices-1);
      max_z_grid = Math.min(Math.max(max_z_grid, 0), this._zSlices-1);

      // Find the screen at the light position
      let alpha = (Math.abs(light_pos_view[2]) - 1.0 * camera.near) / (1.0 * camera.far - 1.0 * camera.near);
      let screen_width_at_light = near_width * (1 - alpha) + far_width * alpha;
      let screen_height_at_light = near_height * (1 - alpha) + far_height * alpha;
      let step_x = screen_width_at_light / (1.0 * this._xSlices);
      let step_y = screen_height_at_light / (1.0 * this._ySlices);
      //Find the range of slices in x, y direction
      let min_x_grid = Math.floor((light_pos_view[0] - light_radius * 1.2 + screen_width_at_light * 0.5) / step_x);
      let max_x_grid = Math.ceil((light_pos_view[0] + light_radius * 1.2 + screen_width_at_light * 0.5) / step_x);

      min_x_grid = Math.min(Math.max(min_x_grid, 0), this._xSlices - 1);
      max_x_grid = Math.min(Math.max(max_x_grid, 0), this._xSlices - 1);

      let min_y_grid = Math.floor((light_pos_view[1] - light_radius * 1.2 + screen_height_at_light * 0.5) / step_y);
      let max_y_grid = Math.ceil((light_pos_view[1] + light_radius * 1.2 + screen_height_at_light * 0.5) / step_y);
    
      min_y_grid = Math.min(Math.max(min_y_grid, 0), this._ySlices-1);
      max_y_grid = Math.min(Math.max(max_y_grid, 0), this._ySlices-1);


      // Assign results to buffer
      for (let z = min_z_grid; z <= max_z_grid; ++z) {
        for (let y = min_y_grid; y <= max_y_grid; ++y) {
          for (let x = min_x_grid; x <= max_x_grid; ++x) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let lights_num = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            if(lights_num >= MAX_LIGHTS_PER_CLUSTER) {
              continue;
            }
            lights_num += 1;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lights_num;
            let component = Math.floor(lights_num / 4.0);
            let offset = lights_num % 4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, component) + offset] = l;
          }
        }
      }      

    }
    this._clusterTexture.update();
  }
}