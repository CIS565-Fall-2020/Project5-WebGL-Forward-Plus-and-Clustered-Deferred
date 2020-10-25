import TextureBuffer from './textureBuffer';
import {Sphere, Frustum, Vector3} from 'three';
import Scene, { NUM_LIGHTS } from '../scene';
import { vec4 } from 'gl-matrix';
export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    // the reason why for adding one is for the num_of_light stored at that slice
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

    var screen_width = camera.getFilmWidth() * 2;
    var screen_height = camera.getFilmHeight() * 2;
    var screen_depth = camera.far - camera.near;

    for (let lid = 0; lid < NUM_LIGHTS; lid ++){
      var cur_light = scene.lights[lid];

      var cur_light_world_pos = vec4.fromValues(
        cur_light.position[0],
        cur_light.position[1],
        cur_light.position[2],
        1.0
      );
      // transform to camera space
      var cur_light_camera_pos = vec4.create();
      vec4.transformMat4(
        cur_light_camera_pos, 
        cur_light_world_pos,
        viewMatrix
      );

      var cur_light_radius = scene.lights[lid].radius;
      let tmp_vec3 = new Vector3(
        cur_light_camera_pos[0],
        cur_light_camera_pos[1],
        cur_light_camera_pos[2]
      );
      let lght_sphr = new Sphere();
      lght_sphr.center = tmp_vec3;
      lght_sphr.radius = cur_light_radius;
      // why I could not use this line
      // let cur_light_camera_sphere = new Sphere(Vector3(
      //   tmp_vector3,
      //   5));
      
      // var cur_frustum = new Frustum();
      // cur_frustum.setFromProjectionMatrix(viewMatrix);

      //for each light,calculate its influence range
      var x_min, x_max, y_min, y_max, z_min, z_max;
      x_min = lght_sphr.center[0] - lght_sphr.radius;
      x_max = lght_sphr.center[0] + lght_sphr.radius;
      y_min = lght_sphr.center[1] - lght_sphr.radius;
      y_max = lght_sphr.center[1] + lght_sphr.radius;
      // z : minus
      z_min = lght_sphr.center[2] - lght_sphr.radius;
      z_max = lght_sphr.center[2] + lght_sphr.radius;

      // for screen, the center is in middle
      x_min = Math.floor( (x_min + screen_width / 2) / screen_width *  this._xSlices);
      x_max = Math.ceil( (x_max + screen_width / 2) / screen_width *  this._xSlices);

      y_min = Math.floor( (y_min + screen_height / 2) / screen_height *  this._ySlices);
      y_max = Math.ceil( (y_max + screen_height / 2) / screen_height *  this._ySlices);

      z_min = ( -z_max - camera.near ) / screen_depth * this._zSlices;
      z_max = ( -z_min - camera.near ) / screen_depth * this._zSlices;
      // clamp

      x_min = clamp(x_min, 0, this._xSlices - 1);
      x_max = clamp(x_max, 0, this._xSlices - 1);
      
      y_min = clamp(y_min, 0, this._ySlices - 1);
      y_max = clamp(y_max, 0, this._ySlices - 1);

      z_min = clamp(z_min, 0, this._zSlices - 1);
      z_max = clamp(z_max, 0, this._zSlices - 1);

      for (let z = z_min; z < z_max; z++){
        for (let y = y_min; y < y_max; y++){
          for (let x = x_min; x < x_max; x++){
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            //Computes the starting buffer index to the current count
            // store the num of light at the very beginning 
            let cluster_start_idx = this._clusterTexture.bufferIndex(i, 0) + 0;
            let cur_count = this._clusterTexture.buffer[cluster_start_idx];
            // ++ when < 
            if (cur_count < MAX_LIGHTS_PER_CLUSTER){
              cur_count ++;
              
              // from texturebuffer.js, a pixel(a unit in texutre) contains 4 floats
              let component = Math.floor(cur_count / 4);
              let rgba_index = this._clusterTexture.bufferIndex(i, component);

              let rgba_offset = cur_count % 4;

              this._clusterTexture.buffer[rgba_index + rgba_offset] = lid;
              this._clusterTexture.buffer[cluster_start_idx] = cur_count;
            }

          }
        }
      }
      
    }

    this._clusterTexture.update();
  }


  
}

function clamp(x, lower, max){
  return Math.min(max, Math.max(x, lower));
}

function get3DsliceIdxFromSphr(sphr, width, height){

}

function getClusterFrustum(){
    // probably never could not be finished
}