import TextureBuffer from './textureBuffer';
import { vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this.firstTime = true;
    this.renderWireframe = false;
  }

  updateClusters(camera, viewMatrix, scene, wireframe, viewProj) {
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

    for (var i = 0; i < NUM_LIGHTS; i++) {

      // find the min and max coordinate of the light
      var light = scene.lights[i];
      var light_pos = vec3.fromValues(light.position[0], light.position[1], light.position[2]);
      let factor = 2.0;
      var light_radius = vec3.fromValues(light.radius + factor, light.radius + factor, light.radius + factor);
      var min_light_world = vec3.create();
      var max_light_world = vec3.create();
      vec3.subtract(min_light_world, light_pos, light_radius);
      vec3.add(max_light_world, light_pos, light_radius);

      // convert bounding points from world to camera space
      var min_light_camera = vec4.fromValues(min_light_world[0], min_light_world[1], min_light_world[2], 1.0);
      var max_light_camera = vec4.fromValues(max_light_world[0], max_light_world[1], max_light_world[2], 1.0);
      vec4.transformMat4(min_light_camera, min_light_camera, viewMatrix);
      vec4.transformMat4(max_light_camera, max_light_camera, viewMatrix);
      min_light_camera[2] = -1.0 * min_light_camera[2];
      max_light_camera[2] = -1.0 * max_light_camera[2];

      // find z slice
      let dist_per_slice = ((camera.far - camera.near) / this._zSlices);
      let z_slice_min = Math.floor(min_light_camera[2] / dist_per_slice) - 1.0;
      let z_slice_max = Math.ceil(max_light_camera[2] / dist_per_slice) + 1.0;

      // find x and y slices
      let radians = (camera.fov / 2.0) * (Math.PI / 180.0);
      let tan = Math.tan(radians);
      //let half_height_min = Math.abs(min_light_camera[2]) * tan;
      let half_height_min = tan;
      let half_width_min = camera.aspect * half_height_min;
      //let half_height_max = Math.abs(max_light_camera[2]) * tan;
      let half_height_max = tan;
      let half_width_max = camera.aspect * half_height_max;

      let x_slice_min = Math.floor((min_light_camera[0] + half_width_min)  / ((half_width_min * 2.0) / this._xSlices)) - 1.0;
      let x_slice_max = Math.ceil((max_light_camera[0] + half_width_max) / ((half_width_max * 2.0) / this._xSlices)) + 1.0;
      let y_slice_min = Math.floor((min_light_camera[1] + half_height_min) / ((half_height_min * 2.0) / this._ySlices)) - 1.0;
      let y_slice_max = Math.ceil((max_light_camera[1] + half_height_max) / ((half_height_max * 2.0) / this._ySlices)) + 1.0;

      z_slice_min = clamp(z_slice_min, 0, this._zSlices - 1);
      z_slice_max = clamp(z_slice_max, 0, this._zSlices - 1);
      y_slice_min = clamp(y_slice_min, 0, this._ySlices - 1);
      y_slice_max = clamp(y_slice_max, 0, this._ySlices - 1);
      x_slice_min = clamp(x_slice_min, 0, this._xSlices - 1);
      x_slice_max = clamp(x_slice_max, 0, this._xSlices - 1);
      
      for (let z = z_slice_min; z <= z_slice_max; ++z) {
        for (let y = y_slice_min; y <= y_slice_max; ++y) {
          for (let x = x_slice_min; x <= x_slice_max; ++x) {
            let index = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let num_lights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)] + 1;
            if (num_lights < MAX_LIGHTS_PER_CLUSTER) {
              let row = Math.floor(num_lights * 0.25);
              let col = num_lights % 4;
              
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, row) + col] = i;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)] = num_lights;
            }
          }
        }
      }

    }

    this.firstTime = false;
    this._clusterTexture.update();
  }
}