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

    var z_near = camera.near
    var z_far = camera.far 
    var x_near = 2 * z_near * Math.tan(camera.fov / 2.0 * Math.PI / 180.0);
    var x_far = 2 * z_far * Math.tan(camera.fov / 2.0 * Math.PI / 180.0);
    var y_near = camera.aspect / x_near;
    var y_far = camera.aspect / y_near;
    var x_cell_near = x_near / this._xSlices;
    var y_cell_near = y_near / this._ySlices;
    var z_cell_len = (z_far - z_near) / this._zSlices;

    for (let i = 0; i < NUM_LIGHTS; i++) {
        var light = scene.lights[i];
        var light_homo = vec4.create(light.position[0], light.position[1], light.position[2], 1.0);
        var light_in_camera;
        mat4.multiply(light_in_camera, viewMatrix, light_homo);
        var light_x = light_in_camera[0];
        var light_y = light_in_camera[1];
        var light_z = Math.abs(light_in_camera[2]);
        var x_cell_len = x_near * light_z / z_near;
        var y_cell_len = y_near * light_z / z_near;
        
        var x_max = Math.ceil((light_x + light.radius) / x_cell_len) - 1;
        var x_min = Math.floor((light_x - light.radius) / x_cell_len) - 1;
        var y_max = Math.ceil(light_y + light.radius/ y_cell_len) - 1;
        var y_min = Math.floor(light_y - light.radius / y_cell_len) - 1;
        var z_max = Math.ceil((light_z + light.radius) / z_cell_len) - 1;
        var z_min = Math.floor((light_z - light.radius) / z_cell_len) - 1;

        x_min = Math.max(0, x_min);
        x_max = Math.min(this._xSlices - 1, x_max);
        y_min = Math.max(0, y_min);
        y_max = Math.min(this._ySlices - 1, y_max);
        z_min = Math.max(0, z_min);
        z_max = Math.min(this._zSlices - 1, z_max);

        for (let x_idx = x_min; x <= x_max; x_idx++) {
          for (let y_idx = y_min; y <= y_max; y_idx++) {
            for (let z_idx = z_min; z <= z_max; z_idx++) {
              var idx = z_idx + y_idx * this._xSlices + x_idx * this._ySlices;
              if (this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] < MAX_LIGHTS_PER_CLUSTER) {
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)]++;
              }
              
            }
          }
        }
    }
    

    this._clusterTexture.update();
  }
}