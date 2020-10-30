import { vec3, vec4, mat4 } from 'gl-matrix';
import { canvas } from '../init';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 200;

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

    //For all lights in the scene 
    //You can base the clusters' X/Y size by uniformly subdividing in screen space.
    //Use var for global scope and let for local scope 

    //Viewing frustum dimensions
    var depth = 50.0 - camera.near; //setting far clip plane to something small
    var height = canvas.height; 
    var width = canvas.width;
    //debugger; 
    //Divide this space about each axis by the number of slices about each axis 
    let slice_X = width / Number(this._xSlices);
    let slice_Y = height / Number(this._ySlices);
    let slice_Z = depth / Number(this._zSlices);

    for (let l = 0; l < NUM_LIGHTS; ++l) {
      //Get light pos and light radius 
      var lightRadius = scene.lights[l].radius;
      //Convert light from world to view space of the camera 
      var lightPos = scene.lights[l].position;
      //debugger; 
      //Convert to vec4 for matrix mul with mat4 
      lightPos = vec4.fromValues(lightPos[0], lightPos[1], lightPos[2], 1.0);
      //Transform the light to camera space 
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      //back to vec3 
      lightPos = vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]);
      lightPos[2] *= -1.0; 
      var lightDepth = lightPos[2];

      //Find the min and max indices - look at diagram 
      //min
      var x_min = Math.max(0, Math.min(Math.floor(lightPos[0] - lightRadius + (0.5 * width) / slice_X), this._xSlices - 1));
      var y_min = Math.max(0, Math.min(Math.floor(lightPos[1] - lightRadius + (0.5 * height) / slice_Y), this._ySlices - 1));
      var z_min = Math.max(0, Math.min(Math.floor(lightPos[2] - lightRadius / slice_Z), this._zSlices - 1));
      //max
      var x_max = Math.max(0, Math.min(Math.floor(lightPos[0] + lightRadius + (0.5 * width) / slice_X), this._xSlices - 1));
      var y_max = Math.max(0, Math.min(Math.floor(lightPos[1] + lightRadius + (0.5 * height) / slice_Y), this._ySlices - 1));
      var z_max = Math.max(0, Math.min(Math.floor(lightPos[2] + lightRadius / slice_Z), this._zSlices - 1));

      //Within the bounds of min and max indices of our cluster, find the list of lights impacting the cluster 
      for (let z = z_min; z <= z_max; ++z) {
        for (let y = y_min; y <= y_max; ++y) {
          for (let x = x_min; x <= x_max; ++x) {
            var clusterIdx_1D = x + (y * this._xSlices) + (z * this._xSlices * this._ySlices);
            var lightCountIdx = this._clusterTexture.bufferIndex(clusterIdx_1D, 0); //first elem will have the count 
            var numLights = this._clusterTexture.buffer[lightCountIdx];
            //debugger; 
            if (numLights < MAX_LIGHTS_PER_CLUSTER) {
              numLights++;
              //this._clusterTexture.buffer[lightCountIdx]++; 
              let row = Math.floor(numLights * 0.25);
              let col = Math.floor(numLights % 4.0);
              //debugger; 
              this._clusterTexture[this._clusterTexture.bufferIndex(clusterIdx_1D, row) + col] = l;
              this._clusterTexture.buffer[lightCountIdx] = numLights;
              //debugger; 
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}