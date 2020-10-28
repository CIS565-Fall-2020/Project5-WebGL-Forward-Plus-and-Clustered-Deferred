import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 500;

function clamp (x, min, max) {
    return Math.max(min, Math.min(x, max));
}

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

    // Writing out Train of Thought: 
    // Generally, what we should do is go through every light, see
    // which clusters it intersects, and add it to the cluster
    // 1. First we need to get world pos of light and convert it to camera space since clusters originate from camera
    // 2. calculate the dimensions of the clusters (strides) 
    // 3. calcualte min/max of cluster indices the light is in
    // 4. add the light to the clusters between the indices

    var camera_frustum_dim = vec3.create();
    camera_frustum_dim[1] = Math.tan(camera.fov / 2.0 * (Math.PI / 180.0)) * 2.0; // height
    camera_frustum_dim[0] = camera_frustum_dim[1] * camera.aspect; // width
    camera_frustum_dim[2] = camera.far - camera.near; // depth

    var slices = vec3.create();
    slices[0] = this._xSlices;
    slices[1] = this._ySlices;
    slices[2] = this._zSlices;

    for (var i = 0; i < scene.lights.length; i++) {

      var light = scene.lights[i];

      // 1. convert light's pos from world space to camera space
      var world_space = vec4.fromValues(light.position[0], 
                                        light.position[1], 
                                        light.position[2], 1.0);
      var camera_space = vec4.create();
      camera_space = vec4.transformMat4(camera_space, world_space, viewMatrix);
      camera_space[2] *= -1.0;
      
      // 2. calculate the dimensions of the clusters (strides)
      var x_half = (camera_frustum_dim[0] * camera_space[2]) / 2.0;
      var x_dim = (camera_frustum_dim[0] * camera_space[2]) / slices[0];

      var y_half = (camera_frustum_dim[1] * camera_space[2]) / 2.0;
      var y_dim = (camera_frustum_dim[1] * camera_space[2]) / slices[1];

      var z_dim = camera_frustum_dim[2] / slices[2];

      // 3. calculate min/max indices of the cluster
      var min_idx = vec3.create();
      var max_idx = vec3.create();

      min_idx[0] = Math.floor((camera_space[0] - scene.lights[i].radius + x_half) / x_dim) - 1;
      max_idx[0] = Math.floor((camera_space[0] + scene.lights[i].radius + x_half) / x_dim) + 1;
      
      min_idx[1] = Math.floor((camera_space[1] - scene.lights[i].radius + y_half) / y_dim);
      max_idx[1] = Math.floor((camera_space[1] + scene.lights[i].radius + y_half) / y_dim);
      
      min_idx[2] = Math.floor((camera_space[2] - scene.lights[i].radius) / z_dim);
      max_idx[2] = Math.floor((camera_space[2] + scene.lights[i].radius) / z_dim);

      for (var c = 0; c < 3; c++) {
        min_idx[c] = clamp(min_idx[c], 0, slices[c] - 1);
        max_idx[c] = clamp(max_idx[c], 0, slices[c] - 1);
      }

      // 4. add light to cluster
      for (var z = min_idx[2]; z <= max_idx[2]; z++) {
        for (var y = min_idx[1]; y <= max_idx[1]; y++) {
          for (var x = min_idx[0]; x <= max_idx[0]; x++) { 
            var idx = x + y * slices[0] + z * slices[0] * slices[1];
            var light_idx = this._clusterTexture.bufferIndex(idx, 0);

            // only add light to cluster if this cluster still has room
            if (this._clusterTexture.buffer[light_idx] < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[light_idx]++; 
              var row = Math.floor(this._clusterTexture.buffer[light_idx] % 4);
              var col = Math.floor(this._clusterTexture.buffer[light_idx] / 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, col) + row] = i;
            }
          }
        }
      } // end adding light to cluster
    }

    this._clusterTexture.update();
  }
}