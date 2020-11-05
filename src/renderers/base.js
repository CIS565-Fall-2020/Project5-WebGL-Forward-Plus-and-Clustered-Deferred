import { NUM_LIGHTS } from '../scene';
import { mat4, vec4 } from 'gl-matrix';
import TextureBuffer from './textureBuffer';

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

    var z_near = 1.0 * camera.near;
    var z_far = 1.0  * camera.far;
    var y_near = 2 * z_near * Math.tan(camera.fov / 2.0 * Math.PI / 180.0);
    //var y_far = 2 * z_far * Math.tan(camera.fov / 2.0 * Math.PI / 180.0);
    var x_near = camera.aspect * y_near;
    //var x_far = camera.aspect * y_far;
    var x_cell_near = x_near / (1.0 * this._xSlices);
    var y_cell_near = y_near / (1.0 * this._ySlices);
    var z_cell_len = (z_far - z_near) / (1.0 * this._zSlices);

    for (let i = 0; i < NUM_LIGHTS; i++) {

        var light = scene.lights[i];
        var light_homo = vec4.create(light.position[0], light.position[1], light.position[2], 1.0);
        var light_in_camera = vec4.create();
        mat4.multiply(light_in_camera, viewMatrix, light_homo);
        
        var light_z = Math.abs(light_in_camera[2]);
        var ratio = light_z / z_near;
        var light_x = light_in_camera[0] + x_near * ratio / 2.0;
        var light_y = light_in_camera[1] + y_near * ratio / 2.0;
        var x_cell_len = x_cell_near * ratio;
        var y_cell_len = y_cell_near * ratio;
        
        var x_max = Math.ceil((light_x + light.radius) / x_cell_len);
        var x_min = Math.floor((light_x - light.radius) / x_cell_len);
        var y_max = Math.ceil((light_y + light.radius) / y_cell_len);
        var y_min = Math.floor((light_y - light.radius) / y_cell_len);
        var z_max = Math.ceil((light_z - z_near + light.radius) / z_cell_len);
        var z_min = Math.floor((light_z - z_near - light.radius) / z_cell_len);
        
        x_min = Math.max(0, x_min);
        x_max = Math.min(this._xSlices - 1, x_max);
        y_min = Math.max(0, y_min);
        y_max = Math.min(this._ySlices - 1, y_max);
        z_min = Math.max(0, z_min);
        z_max = Math.min(this._zSlices - 1, z_max);
        
        for (let z_idx = z_min; z_idx <= z_max; z_idx++) {
          for (let y_idx = y_min; y_idx <= y_max; y_idx++) {
            for (let x_idx = x_min; x_idx <= x_max; x_idx++) {
              var idx = x_idx + y_idx * this._xSlices + z_idx * this._ySlices * this._xSlices;
              if (this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] < MAX_LIGHTS_PER_CLUSTER) {
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)]++;
                
                var n_light = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] + 1;
                var r = n_light / 4;
                var c = n_light % 4;
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, r) + c] = i;
              }
            }
          }
        }
        
    }
    
    this._clusterTexture.update();
  }
}