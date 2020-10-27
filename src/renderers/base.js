import TextureBuffer from './textureBuffer';
import {Sphere, Frustum, Vector3, Matrix4, Vector4, Plane} from 'three';
import Scene, { NUM_LIGHTS } from '../scene';
import { vec3 ,vec4 } from 'gl-matrix';
import Wireframe from '../wireframe';
export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    // the reason why for adding one is for the num_of_light stored at that slice
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._wireFramer = new Wireframe();
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

    var cluster_NDC_size = new Vector3(
      2.0 / this._xSlices,
      2.0 / this._ySlices,
      2.0 / this._zSlices,
    );

    //cluster_NDC_size.multiplyScalar(0.5);
    // to recover w component
    var Z_range = camera.far - camera.near;
    var Z_size = Z_range / this._zSlices;

    var transProjectionMatrix = new Matrix4();
    transProjectionMatrix.copy(camera.projectionMatrix);
    transProjectionMatrix.transpose();

    var inverseProjectionMatrix = new Matrix4();
    inverseProjectionMatrix.getInverse(camera.projectionMatrix);
    
    var inverseViewMatrix = new Matrix4();
    inverseViewMatrix.copy(camera.matrixWorld);

    var inverseViewProjectionMatrix = new Matrix4();
    inverseViewProjectionMatrix.multiplyMatrices(
      inverseViewMatrix,
      inverseProjectionMatrix
      );

    // store the light sphere in an array 
    var sphr_arr = []
    for (let lid = 0; lid < NUM_LIGHTS; lid ++){
      sphr_arr[lid] = get_view_Sphere(scene, lid, viewMatrix);
    }
    var offset = new Vector3(-1.0, -1.0, -1.0, 0.0);
    
    function get_frustum_plane(ndc_m, ndc_n){
      ndc_n.applyMatrix4(transProjectionMatrix);
      ndc_m.multiply(cluster_NDC_size);
      ndc_m.add(offset);
      // not sure the matrix multiplication is right
      ndc_m = new Vector4(ndc_m.x, ndc_m.y, ndc_m.z);
      ndc_m.multiplyScalar(get_W(ndc_m.z));
      ndc_m.applyMatrix4(inverseProjectionMatrix);
      let m = new Vector3(ndc_m.x, ndc_m.y, ndc_m.z);
      let n = new Vector3(ndc_n.x, ndc_n.y, ndc_n.z);
      n.normalize();
      return new Plane(n, m);
    }

    var T2 = camera.projectionMatrix.elements[14];
    var T1 = camera.projectionMatrix.elements[10];
    var E1 = -1;

    function get_W(ndc_Z){
      return T2 / (ndc_Z - T1 / E1);
    }
    // for each frustum, traverse each light
    for (let z = 0; z < this._zSlices; z++) {
      for (let y = 0; y < this._ySlices; y++) {
        for (let x = 0; x < this._xSlices; x++) {
          //console.log(x,y,z);
          // get the frustum
          var n, m; // n : normal, m: middle point of face of cluster(grid) 
          //n = new Vector4(0.0, 0.0, 0.0, 0.0); m = new Vector3();
          
          var P0, P1, P2, P3, P4, P5;
          // z near,
          n = new Vector4(0.0, 0.0, 1.0, 0.0);
          m = new Vector3(x + 0.5, y + 0.5, z);
          P0 = get_frustum_plane(m, n);
          
          // z far,
          n = new Vector4(0.0, 0.0, -1.0, 0.0);
          m = new Vector3(x + 0.5, y + 0.5, z + 1.0);
          P1 = get_frustum_plane(m, n);

          // left
          n = new Vector4(-1.0, 0.0, 0.0, 0.0);
          m = new Vector3(x, y + 0.5, z + 0.5);
          P2 = get_frustum_plane(m, n);
          
          // right
          n = new Vector4(1.0, 0.0, 0.0, 0.0);
          m = new Vector3(x + 1.0, y + 0.5, z + 0.5);
          P3 = get_frustum_plane(m, n);
          
          // up,
          n = new Vector4(0.0, -1.0, 0.0, 0.0);
          m = new Vector3(x + 0.5, y, z + 0.5);
          P4 = get_frustum_plane(m, n);

          // down
          n = new Vector4(0.0, 1.0, 0.0, 0.0);
          m = new Vector3(x + 0.5, y + 1.0, z + 0.5);
          P5 = get_frustum_plane(m, n);
          
          var cur_frstm = new Frustum(P0, P1, P2, P3, P4, P5);
          // to visualize
          // var left_bottom_near = new Vector3(x, y, z);
          // var right_up_far = new Vector3(x + 1, y + 1, z + 1);
          
          // left_bottom_near.multiply(cluster_NDC_size);
          // right_up_far.multiply(cluster_NDC_size); 
          
          // left_bottom_near.add(offset);
          // right_up_far.add(offset);
          
          // //debugger;

          // left_bottom_near = new Vector4(left_bottom_near.x, left_bottom_near.y, left_bottom_near.z);
          // right_up_far = new Vector4(right_up_far.x, right_up_far.y, right_up_far.z);
          
          // // to recover W
          // left_bottom_near.multiplyScalar(get_W(left_bottom_near.z));
          // right_up_far.multiplyScalar(get_W(right_up_far.z));

          // var tmp_left = left_bottom_near.clone();
          // tmp_left.applyMatrix4(inverseProjectionMatrix);

          // var tmp_right = right_up_far.clone();
          // tmp_right.applyMatrix4(inverseProjectionMatrix);

          // //debugger;

          // left_bottom_near.applyMatrix4(inverseViewProjectionMatrix);
          // right_up_far.applyMatrix4(inverseViewProjectionMatrix);
          
          // //debugger;
          // var cur_color = new Vector3(x+1, y+1, z+1);
          // var slice_size = new Vector3(this._xSlices, this._ySlices, this._zSlices);
          // cur_color.divide(slice_size);

          // var start_pos = [left_bottom_near.x, left_bottom_near.y, left_bottom_near.z];
          // var end_pos = [right_up_far.x, right_up_far.y, right_up_far.z];
          // var segmentColor = [cur_color.x, cur_color.y, cur_color.z];
          // this._wireFramer.addLineSegment(start_pos, end_pos, segmentColor);
          
          for (let lid = 0; lid < NUM_LIGHTS; lid ++){
            let cur_sphr = sphr_arr[lid];
            if (cur_frstm.intersectsSphere(cur_sphr)){
              let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

              let cluster_start_idx = this._clusterTexture.bufferIndex(i, 0) + 0;
              let cur_count = this._clusterTexture.buffer[cluster_start_idx];
              
              if (cur_count < MAX_LIGHTS_PER_CLUSTER){
                cur_count ++;
                // from texturebuffer.js, a pixel(a unit in texutre) contains 4 floats
              let component = Math.floor(cur_count / 4);
              let rgba_index = this._clusterTexture.bufferIndex(i, component);

              let rgba_offset = cur_count % 4;
              
              this._clusterTexture.buffer[rgba_index + rgba_offset] = lid;
              this._clusterTexture.buffer[cluster_start_idx] = cur_count;
              //debugger;
              }

            }
          }


        }
      }
    }
    
    //debugger;
    this._clusterTexture.update();
    
  }


  
}

function create_plane(){

}

function clamp(x, lower, max){
  return Math.min(max, Math.max(x, lower));
}

function get_view_Sphere(scene, lid, viewMatrix){
  // transform to camera space
  var cur_light = scene.lights[lid];

  var cur_light_world_pos = vec4.fromValues(
    cur_light.position[0],
    cur_light.position[1],
    cur_light.position[2],
    1.0
  );

  var cur_light_camera_pos = vec4.create();
  // vec4.transformMat4(
  //   cur_light_camera_pos, 
  //   cur_light_world_pos,
  //   viewMatrix
  // );

  var cur_light_radius = scene.lights[lid].radius;
  var tmp_vec3 = new Vector3(
    cur_light_camera_pos[0],
    cur_light_camera_pos[1],
    cur_light_camera_pos[2]
  );

  var lght_sphr = new Sphere();
  lght_sphr.center = tmp_vec3;
  lght_sphr.radius = cur_light_radius;
  return lght_sphr;
}



function origin_assign_light_func(){
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
      x_min = lght_sphr.center.x - lght_sphr.radius;
      x_max = lght_sphr.center.x + lght_sphr.radius;
      y_min = lght_sphr.center.y - lght_sphr.radius;
      y_max = lght_sphr.center.y + lght_sphr.radius;
      // z : minus
      z_min = lght_sphr.center.z - lght_sphr.radius;
      z_max = lght_sphr.center.z + lght_sphr.radius;

      // for screen, the center is in middle
      x_min = Math.floor( (x_min + screen_width / 2) / screen_width *  this._xSlices);
      x_max = Math.ceil( (x_max + screen_width / 2) / screen_width *  this._xSlices);

      y_min = Math.floor( (y_min + screen_height / 2) / screen_height *  this._ySlices);
      y_max = Math.ceil( (y_max + screen_height / 2) / screen_height *  this._ySlices);

      z_min = Math.floor( ( -z_max - camera.near ) / screen_depth * this._zSlices );
      z_max = Math.ceil( ( -z_min - camera.near ) / screen_depth * this._zSlices );
      // clamp
      //debugger;
      x_min = clamp(x_min, 0, this._xSlices - 1);
      x_max = clamp(x_max, 0, this._xSlices - 1);
      
      y_min = clamp(y_min, 0, this._ySlices - 1);
      y_max = clamp(y_max, 0, this._ySlices - 1);

      z_min = clamp(z_min, 0, this._zSlices - 1);
      z_max = clamp(z_max, 0, this._zSlices - 1);
      
      //debugger;
      for (let z = z_min; z <= z_max; z++){
        for (let y = y_min; y <= y_max; y++){
          for (let x = x_min; x <= x_max; x++){
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
              //debugger;
            }

          }
        }
      }
      
    }
}

function getClusterFrustum(){
    // probably never could not be finished

}