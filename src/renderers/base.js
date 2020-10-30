import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3 } from 'gl-matrix';
import Wireframe from '../wireframe';

export const MAX_LIGHTS_PER_CLUSTER = 100;
export const frustumWireframe = new Wireframe();

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  // p0, p1, p2 are points on the plane in counterclockwise order.
  pointPlaneDistance(p0, p1, p2, pc) {
    var planeNormal = vec3.create();
    var d01 = vec3.create();
    var d02 = vec3.create();
    vec3.subtract(d01, p1, p0);
    vec3.subtract(d02, p2, p0);
    vec3.cross(planeNormal, d01, d02);
    vec3.normalize(planeNormal, planeNormal);
    // Plane: ax + by + cx + d = 0
    
    var d0c = vec3.create();
    vec3.subtract(d0c, pc, p0);
    return vec3.dot(planeNormal, d0c);
  }

  // l: left r: right b: bottom t: top n: near f: far 
  // sc: sphere center sr: sphere radius
  sphereFrustumIntersect(lbn, lbf, rbn, rbf, ltn, ltf, rtn, rtf, sc, sr) {
    var faces = [
      [rtn, ltn, lbn],  // near
      [ltn, ltf, lbf],  // left
      [ltf, rtf, rbf],  // far
      [rtf, rtn, rbn],  // right
      [rtf, ltf, ltn],  // top
      [rbn, lbn, lbf],  // bottom
    ];
    var result = true;
    for (let i = 0; i < 6; ++i)
    {
      var d = this.pointPlaneDistance(faces[i][0], faces[i][1], faces[i][2], sc);
      if (d < -sr)
      {
        return false;
      }
      // else if (d < sr)
      // {
      //   result = true;
      // }
    }
    return result;
  }

  updateClusters(camera, viewMatrix, scene, depthMax) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    var depth = (depthMax - camera.near);
    var dz = depth / this._zSlices;
    var tanHalfFov = Math.tan(camera.fov / 2 * Math.PI / 180);

    for (let z = 0; z < this._zSlices; ++z) {
      var zmin = z * dz + camera.near;
      var zmax = (z + 1) * dz + camera.near;
      var heightMin = (tanHalfFov * zmin) * 2;
      var heightMax = (tanHalfFov * zmax) * 2;
      var widthMin = camera.aspect * heightMin;
      var widthMax = camera.aspect * heightMax;
      var dymin = heightMin / this._ySlices;
      var dymax = heightMax / this._ySlices;
      var dxmin = widthMin / this._xSlices;
      var dxmax = widthMax / this._xSlices;
      for (let y = 0; y < this._ySlices; ++y) {
        var yminNear = y * dymin - heightMin / 2;
        var ymaxNear = (y + 1) * dymin - heightMin / 2;
        var yminFar = y * dymax - heightMax / 2;
        var ymaxFar = (y + 1) * dymax - heightMax / 2;
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          var lightCnt = 0;
          // Find 8 vertexs of the frustum
          var xminNear = x * dxmin - widthMin / 2;
          var xmaxNear = (x + 1) * dxmin - widthMin / 2;
          var xminFar = x * dxmax - widthMax / 2;
          var xmaxFar = (x + 1) * dxmax - widthMax / 2;
          

          for (let lid = 0; lid < scene.lights.length; ++lid)
          {
            var light = scene.lights[lid];
            var lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
            vec4.transformMat4(lightPos, lightPos, viewMatrix); // Convert lightPos from world space to view space
            lightPos[2] *= -1.0;
            var lightRadius = light.radius;
            if (lightCnt <= MAX_LIGHTS_PER_CLUSTER)
            {
              var intersect = this.sphereFrustumIntersect(vec3.fromValues(xminNear, yminNear, zmin),
                                                          vec3.fromValues(xminFar, yminFar, zmax),
                                                          vec3.fromValues(xmaxNear, yminNear, zmin),
                                                          vec3.fromValues(xmaxFar, yminFar, zmax),
                                                          vec3.fromValues(xminNear, ymaxNear, zmin),
                                                          vec3.fromValues(xminFar, ymaxFar, zmax),
                                                          vec3.fromValues(xmaxNear, ymaxNear, zmin),
                                                          vec3.fromValues(xmaxFar, ymaxFar, zmax),
                                                          vec3.fromValues(lightPos[0], lightPos[1], lightPos[2]),
                                                          lightRadius );
              if (intersect)
              {
                lightCnt++;
                var index = this._clusterTexture.bufferIndex(i, Math.floor(lightCnt / 4)) + lightCnt % 4;
                this._clusterTexture.buffer[index] = lid;
              }
            }
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lightCnt;        
        }
      }
    }
    
    this._clusterTexture.update();
  }
}