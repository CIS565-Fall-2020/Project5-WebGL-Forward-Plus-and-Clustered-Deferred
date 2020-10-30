import { canvas } from '../init';
import TextureBuffer from './textureBuffer';
import { Plane, Sphere, Frustum, Vector3 } from 'three';

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

    var x_size = canvas.clientWidth / this._xSlices;
    var y_size = canvas.clientHeight / this._ySlices;
    var z_size = 200 / this._zSlices; // hardcode 200 - maybe change it later

    // Frustum plane normals
    var nor_top = new Vector3(0, -1, 0);
    var nor_bottom = new Vector3(0, 1, 0);
    var nor_left = new Vector3(-1, 0, 0);
    var nor_right = new Vector3(1, 0, 0);
    var nor_near = new Vector3(0, 0, 1);
    var nor_far = new Vector3(0, 0, -1);

    for (let z = 0; z < 200 - z_size; z += z_size) {
      for (let y = 0; y < canvas.clientHeight - y_size; y += y_size) {
        for (let x = 0; x < canvas.clientWidth - x_size; x += x_size) {
        }
      }
    }

    this._clusterTexture.update();
  }
}