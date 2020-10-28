import TextureBuffer from './textureBuffer';
import {Sphere, Frustum, Vector3, Matrix4, Vector4, Plane, Matrix3} from 'three';
import Scene, { NUM_LIGHTS } from '../scene';
import { vec3 ,vec4 } from 'gl-matrix';
import Wireframe from '../wireframe';
export const MAX_LIGHTS_PER_CLUSTER = 512;

const draw_line = false;
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
    //var Z_range = camera.far - camera.near;
    //var Z_size = Z_range / this._zSlices;

    

    var inverseProjectionMatrix = new Matrix4();
    inverseProjectionMatrix.getInverse(camera.projectionMatrix);
    
    var inverseViewMatrix = new Matrix4();
    inverseViewMatrix.copy(camera.matrixWorld);

    var inverseViewProjectionMatrix = new Matrix4();
    inverseViewProjectionMatrix.multiplyMatrices(
      inverseViewMatrix,
      inverseProjectionMatrix
      );
    // get the matrix to transfer normal from NDC -> world space
    var mat3NormalProj2World = new Matrix3();
    // let tmp = new Matrix4();
    // tmp.multiplyMatrices(
    //   camera.matrixWorldInverse,
    //   camera.projectionMatrix
    //   );
    mat3NormalProj2World.getNormalMatrix(inverseViewProjectionMatrix);

    // store the light sphere in an array 
    var sphr_arr = []
    for (let lid = 0; lid < NUM_LIGHTS; lid ++){
      sphr_arr[lid] = get_world_Sphere(scene, lid, viewMatrix);
    }
    var offset = new Vector3(-1.0, -1.0, -1.0, 0.0);
    
    var T2 = camera.projectionMatrix.elements[14];
    var T1 = camera.projectionMatrix.elements[10];
    var E1 = -1;

    function get_W(ndc_Z){
      return T2 / (ndc_Z - T1 / E1);
    }

    function idx2World(x, y, z){
      // return 4d vec
      var world_p = idx2ClipPos(x, y, z);
      world_p.applyMatrix4(inverseViewProjectionMatrix);
      return world_p;
    }

    function vec2arr(v){
      return [v.x, v.y, v.z];
    }

    function arr2vec(a){
      var v = new Vector3(a[0], a[1], a[2]);
      return v;
    }

    function idx2WorldArray(x, y, z){
      var vec = idx2World(x, y, z);
      return vec2arr(vec);
    }

    function idx2ClipPos(x, y, z){
      var P;
      P = new Vector3(x, y, z);
      P.multiply(cluster_NDC_size);
      P.add(offset);
      // add 1 to W
      P = new Vector4(P.x, P.y, P.z);
      P.multiplyScalar(get_W(P.z));
      return P;
    }

    function get_normal(p0, p1, p2){
      p0 = arr2vec(p0);
      p1 = arr2vec(p1);
      p2 = arr2vec(p2);

      let p01 = new Vector3();
      let p02 = new Vector3();
      p01.subVectors(p1, p0);
      p02.subVectors(p2, p0);
      
      var n = new Vector3();
      n.crossVectors(p01, p02);
      n.normalize();
      
      return n;
    }

    function vis_normal(n , p, render){
      let p2 = new Vector3();
      p2.addVectors(p, n);
      render._wireFramer.addLineSegment(vec2arr(p), vec2arr(p2), [0, 1, 0]);
    }

    function get_frustum(x, y, z, render){
      var p0, p1, p2, p3, p4, p5, p6, p7;
      // transfer all the point to world space
      p0 = idx2WorldArray(x,y,z);
      p1 = idx2WorldArray(x+1,y,z);
      p2 = idx2WorldArray(x+1,y+1,z);
      p3 = idx2WorldArray(x,y+1,z);
      p4 = idx2WorldArray(x,y,z+1);
      p5 = idx2WorldArray(x+1,y,z+1);
      p6 = idx2WorldArray(x+1,y+1,z+1);
      p7 = idx2WorldArray(x,y+1,z+1);
      
      // get normal
      var n0, n1, n2, n3, n4, n5;
      // near
      n0 = get_normal(p0, p1, p3);
      // far
      n1 = get_normal(p4, p7, p5);
      // left
      n2 = get_normal(p0, p3, p4);
      // right
      n3 = get_normal(p1, p5, p2);
      // up
      n4 = get_normal(p2, p6, p3);
      // down
      n5 = get_normal(p1, p0, p5);

      var P0, P1, P2, P3, P4, P5;
      P0 = new Plane();
      P1 = new Plane();
      P2 = new Plane();
      P3 = new Plane();
      P4 = new Plane();
      P5 = new Plane();

      // P0.setFromCoplanarPoints(arr2vec(p2), arr2vec(p3), arr2vec(p0));
      // P1.setFromCoplanarPoints(arr2vec(p7), arr2vec(p6), arr2vec(p5));
      // P2.setFromCoplanarPoints(arr2vec(p3), arr2vec(p7), arr2vec(p4));
      // P3.setFromCoplanarPoints(arr2vec(p6), arr2vec(p2), arr2vec(p1));
      // P4.setFromCoplanarPoints(arr2vec(p6), arr2vec(p7), arr2vec(p3));
      // P5.setFromCoplanarPoints(arr2vec(p1), arr2vec(p0), arr2vec(p4));
      //debugger;

      // P0.setFromNormalAndCoplanarPoint(n0, arr2vec(p0));

      // P1.setFromNormalAndCoplanarPoint(n1, arr2vec(p6));

      // P2.setFromNormalAndCoplanarPoint(n2, arr2vec(p0));

      // P3.setFromNormalAndCoplanarPoint(n3, arr2vec(p6));

      // P4.setFromNormalAndCoplanarPoint(n4, arr2vec(p6));

      // P5.setFromNormalAndCoplanarPoint(n5, arr2vec(p0));
      P0 = new Plane(n0, arr2vec(p0).length());
      P1 = new Plane(n1, arr2vec(p4).length());
      P2 = new Plane(n2, arr2vec(p0).length());
      P3 = new Plane(n3, arr2vec(p1).length());
      P4 = new Plane(n4, arr2vec(p2).length());
      P5 = new Plane(n5, arr2vec(p0).length());

      // 12 edge
      if (draw_line){
        var cur_color = [1, 0, 0];
      
        render._wireFramer.addLineSegment(p0, p1, cur_color);
        render._wireFramer.addLineSegment(p2, p1, cur_color);
        render._wireFramer.addLineSegment(p0, p3, cur_color);
        render._wireFramer.addLineSegment(p2, p3, cur_color);
        render._wireFramer.addLineSegment(p1, p5, cur_color);
        render._wireFramer.addLineSegment(p2, p6, cur_color);
        render._wireFramer.addLineSegment(p0, p4, cur_color);
        render._wireFramer.addLineSegment(p3, p7, cur_color);
        render._wireFramer.addLineSegment(p4, p5, cur_color);
        render._wireFramer.addLineSegment(p5, p6, cur_color);
        render._wireFramer.addLineSegment(p6, p7, cur_color);
        render._wireFramer.addLineSegment(p4, p7, cur_color);

        // visualize normal
        var normal_color = [0, 0, 1];
        var m0, m1, m2, m3, m4, m5;
        m0 = idx2World(x+0.5, y+0.5, z);
        m1 = idx2World(x+0.5, y+0.5, z+1);
        m2 = idx2World(x, y+0.5, z+0.5);
        m3 = idx2World(x+1, y+0.5, z+0.5);
        m4 = idx2World(x+0.5, y+1, z+0.5);
        m5 = idx2World(x+0.5, y, z+0.5);
        
        vis_normal(n0, m0, render);
        vis_normal(n1, m1, render);
        vis_normal(n2, m2, render);
        vis_normal(n3, m3, render);
        vis_normal(n4, m4, render);
        vis_normal(n5, m5, render);
      }


      return new Frustum(P0, P1, P2, P3, P4, P5);
      

    }
    // for each frustum, traverse each light
    for (let z = 0; z < this._zSlices; z++) {
      for (let y = 0; y < this._ySlices; y++) {
        for (let x = 0; x < this._xSlices; x++) {
          // get the frustu
        
          
          //debugger;
          //var cur_frstm = new Frustum(P0, P1, P2, P3, P4, P5);
          var cur_frstm = get_frustum(x, y, z, this);
          //cur_frstm.setFromProjectionMatrix(camera.projectionMatrix);
          //debugger;
          var i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          for (let lid = 0; lid < NUM_LIGHTS; lid ++){
            let cur_sphr = sphr_arr[lid];
            //debugger;
            if (cur_frstm.intersectsSphere(cur_sphr)){
              //debugger;
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
                //console.log(x, y, z, ": ", lid, ' with ' ,cur_count);

              //debugger;
              }

            }
          }


        }
      }
    }
    this._wireFramer._lock = true;
    //debugger;
    this._clusterTexture.update();
    
  }


  
}

function create_plane(){

}

function clamp(x, lower, max){
  return Math.min(max, Math.max(x, lower));
}

function get_world_Sphere(scene, lid, viewMatrix){
  // get three.sphere in world space
  var cur_light = scene.lights[lid];

  var radius = scene.lights[lid].radius;
  var pos = new Vector3(
    cur_light.position[0],
    cur_light.position[1],
    cur_light.position[2]
  );

  var sphr = new Sphere(pos, radius);
  return sphr 
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