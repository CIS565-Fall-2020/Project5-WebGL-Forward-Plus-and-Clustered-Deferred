import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { canvas } from '../init';
import { NUM_LIGHTS } from '../scene';
import { Frustum, Plane, Sphere, Vector3 } from 'three';

export const MAX_LIGHTS_PER_CLUSTER = 100;

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


  screenToWorld(invertedProjView, x, y, z, xSlices, ySlices, zSlices, farClip) {
    // get pixels
    var px = x * (canvas.width / xSlices);
    var py = y * (canvas.height / ySlices);

    // pixels to ndc
    var ndc = vec4.create();
    ndc[0] = ((px / canvas.width) * 2.0) - 1.0;
    ndc[1] = 1.0 - ((py / canvas.height) * 2.0);
    ndc[2] = 1.0;
    ndc[3] = 1.0;
    vec4.scale(ndc, ndc, farClip)
    
    var camera_space = vec4.create();
    vec4.transformMat4(camera_space, ndc, invertedProjView);

    var world = vec4.create();
    vec4.set(world, camera_space[0], camera_space[1], camera_space[2], 1.0);

    return world
  }

  subFrustumPoint(invertedProjView, x, y, z, xSlices, ySlices, zSlices, near_clip_pt, far_clip_pt, farClip) {
    var between_near_far_pt = vec4.create();
    vec4.subtract(between_near_far_pt, far_clip_pt, near_clip_pt);
    
    var z_scale = z / zSlices;
    var world_z_scaled = vec4.create();
    vec4.set(world_z_scaled, between_near_far_pt[0] * z_scale, between_near_far_pt[1] * z_scale, between_near_far_pt[2] * z_scale, 1.0);
    
    vec4.add(world_z_scaled, world_z_scaled, near_clip_pt);
    var as_vec3 = vec3.fromValues(world_z_scaled[0], world_z_scaled[1], world_z_scaled[2]);
    return as_vec3;
  }

  addToWireframe(p1, p2, wireframe) {
    var segmentStart = [p1[0], p1[1], p1[2]];
    var segmentEnd = [p2[0], p2[1], p2[2]];
    var segmentColor = [1.0, 0.0, 0.0];
    wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
  }

  normal(p1, p2, p3) {
    var v1 = vec3.create();
    vec3.subtract(v1, p2, p1);
    var v2 = vec3.create();
    vec3.subtract(v2, p3, p1);
    var n = vec3.create();
    vec3.cross(n, v1, v2);
    vec3.normalize(n, n);
    var vec3_n = new Vector3(n[0], n[1], n[2]);
    return vec3_n;
  }

  createSubFrustum(pt_n_b_l, pt_n_b_r, pt_n_u_l, pt_n_u_r, pt_f_b_l, pt_f_b_r, pt_f_u_l, pt_f_u_r) {
    var n0 = this.normal(pt_n_b_l, pt_n_b_r, pt_n_u_l); // back plane
    var n1 = this.normal(pt_f_b_l, pt_f_u_l, pt_f_b_r); // front plane
    var n2 = this.normal(pt_f_u_l, pt_f_u_r, pt_n_u_l); // top plane
    var n3 = this.normal(pt_n_b_r, pt_f_b_r, pt_n_b_l); // bottom plane
    var n4 = this.normal(pt_n_b_r, pt_n_u_r, pt_f_b_r); // right plane
    var n5 = this.normal(pt_n_b_l, pt_f_b_l, pt_n_u_l); // left plane
    var p0 = new Plane(n0);
    var p1 = new Plane(n1);
    var p2 = new Plane(n2);
    var p3 = new Plane(n3);
    var p4 = new Plane(n4);
    var p5 = new Plane(n5);
    let f = new Frustum(p0, p1, p2, p3, p4, p5);
    return f;
  }

  updateClusters(camera, viewMatrix, scene, wireframe) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          // create inverse proj view matrix
          var invertedProjView = mat4.create();
          var invertedView = mat4.create();
          mat4.invert(invertedView, viewMatrix);
          var invertedProj = mat4.create();
          mat4.invert(invertedProj, camera.projectionMatrix.elements);
          var invertedProjView = mat4.create();
          mat4.multiply(invertedProjView, invertedView, invertedProj);

          var near_l_d = this.screenToWorld(invertedProjView, x, y, z, this._xSlices, this._ySlices, this._zSlices, camera.near);
          var far_l_d = this.screenToWorld(invertedProjView, x, y, z+1, this._xSlices, this._ySlices, this._zSlices, camera.far);
          var near_l_u  = this.screenToWorld(invertedProjView, x, y+1, z, this._xSlices, this._ySlices, this._zSlices, camera.near);
          var far_l_u = this.screenToWorld(invertedProjView, x, y+1, z+1, this._xSlices, this._ySlices, this._zSlices, camera.far);
          var near_r_d  = this.screenToWorld(invertedProjView, x+1, y, z, this._xSlices, this._ySlices, this._zSlices, camera.near);
          var far_r_d = this.screenToWorld(invertedProjView, x+1, y, z+1, this._xSlices, this._ySlices, this._zSlices, camera.far);
          var near_r_u  = this.screenToWorld(invertedProjView, x+1, y+1, z, this._xSlices, this._ySlices, this._zSlices, camera.near);
          var far_r_u = this.screenToWorld(invertedProjView, x+1, y+1, z+1, this._xSlices, this._ySlices, this._zSlices, camera.far);

          var s_near_l_d = this.subFrustumPoint(invertedProjView, x, y, z, this._xSlices, this._ySlices, this._zSlices, near_l_d, far_l_d, camera.far);
          var s_far_l_d  = this.subFrustumPoint(invertedProjView, x, y, z+1, this._xSlices, this._ySlices, this._zSlices, near_l_d, far_l_d, camera.far);
          var s_near_l_u = this.subFrustumPoint(invertedProjView, x, y+1, z, this._xSlices, this._ySlices, this._zSlices, near_l_u, far_l_u, camera.far);
          var s_far_l_u  = this.subFrustumPoint(invertedProjView, x, y+1, z+1, this._xSlices, this._ySlices, this._zSlices, near_l_u, far_l_u, camera.far);
          var s_near_r_d = this.subFrustumPoint(invertedProjView, x+1, y, z, this._xSlices, this._ySlices, this._zSlices, near_r_d, far_r_d, camera.far);
          var s_far_r_d  = this.subFrustumPoint(invertedProjView, x+1, y, z+1, this._xSlices, this._ySlices, this._zSlices, near_r_d, far_r_d, camera.far);
          var s_near_r_u = this.subFrustumPoint(invertedProjView, x+1, y+1, z, this._xSlices, this._ySlices, this._zSlices, near_r_u, far_r_u, camera.far);
          var s_far_r_u  = this.subFrustumPoint(invertedProjView, x+1, y+1, z+1, this._xSlices, this._ySlices, this._zSlices, near_r_u, far_r_u, camera.far);

          // show wireframe of the frustums
          if (this.firstTime && this.renderWireframe) {
            // back plane
            this.addToWireframe(s_near_l_d, s_near_l_u, wireframe);
            this.addToWireframe(s_near_l_u, s_near_r_u, wireframe);
            this.addToWireframe(s_near_r_u, s_near_r_d, wireframe);
            this.addToWireframe(s_near_r_d, s_near_l_d, wireframe);

            // front plane
            this.addToWireframe(s_far_l_d, s_far_l_u, wireframe);
            this.addToWireframe(s_far_l_u, s_far_r_u, wireframe);
            this.addToWireframe(s_far_r_u, s_far_r_d, wireframe);
            this.addToWireframe(s_far_r_d, s_far_l_d, wireframe);

            // side planes
            this.addToWireframe(s_near_l_d, s_far_l_d, wireframe);
            this.addToWireframe(s_near_l_u, s_far_l_u, wireframe);
            this.addToWireframe(s_near_r_d, s_far_r_d, wireframe);
            this.addToWireframe(s_near_r_u, s_far_r_u, wireframe);
          }

          // find which lights are within each clusters
          var subFrustum = this.createSubFrustum(s_near_l_d, s_near_r_d, s_near_l_u, s_near_r_u, s_far_l_d, s_far_r_d, s_far_l_u, s_far_r_u);
          let lightIndex = 1;
          for (var j = 0; j < NUM_LIGHTS; j++) {
            var light = scene.lights[j];
            let light_pos = new Vector3(light.position[0], light.position[1], light.position[2]);
            let light_radius = light.radius;
            var sphere = new Sphere(light_pos, light_radius);
            if (subFrustum.intersectsSphere(sphere)) {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, lightIndex)] = j;
              lightIndex++;
            }
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lightIndex - 1;
        }
      }
    }
    this.firstTime = false;
    this._clusterTexture.update();
  }
}