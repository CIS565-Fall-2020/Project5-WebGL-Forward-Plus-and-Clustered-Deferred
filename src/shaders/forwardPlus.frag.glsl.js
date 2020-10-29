export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewMatrix;
  uniform vec4 u_cameraInfo;
  uniform vec4 u_slicesInfo;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    // surface tangent
    vec3 surftan = normalize(cross(geomnor, up));
    // surface binormal
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // determine which lights have influence using the u_clusterbuffer
    // xSlices, ySlices, zSlices
    // camera orientation information: cam view matrix
    // frustum information vFOV, aspectRatio, near, far
    vec4 camSpacePos = u_viewMatrix * vec4(v_position, 1.0);
    int xSlices = int(u_slicesInfo.x);
    int ySlices = int(u_slicesInfo.y);
    int zSlices = int(u_slicesInfo.z);
    float vFOV = u_cameraInfo.x;
    float aspectRatio = u_cameraInfo.y;
    float near = u_cameraInfo.z;
    float far = u_cameraInfo.w;

    int zFrustum = int(camSpacePos.z - near) / zSlices;
    int yFrustum = int(camSpacePos.y + camSpacePos.z * tan(vFOV / 2.0)) / ySlices;
    float hFOV = 2.0 * atan((aspectRatio * far * tan(vFOV / 2.0)) / far);
    int xFrustum = int(camSpacePos.x + camSpacePos.z * tan(hFOV / 2.0)) / xSlices;
    int iFrustum = xFrustum + yFrustum * xSlices + zFrustum * xSlices * ySlices; // line 105
    int imageWidth = xSlices * ySlices * zSlices;
    // this will be the cluster index
    float u = float(iFrustum + 1) / float(xSlices * ySlices * zSlices + 1);
    // I HAVE HARD CODED IN THE IMAGE HEIGHT SO 
    // THIS WILL LIKELY HAVE TO BE PASSED IN AS A PARAMETER
    int imageHeight = int(ceil((100.0 + 1.0) / 4.0));
    int lightsPerFrustum = int(texture2D(u_clusterbuffer, vec2(u, 1.0 / float(imageHeight + 1))).r);
    // for (int p = 1; p < imageHeight; p++) {
    //   float v = float(p + 1) / float(imageHeight + 1);
    //   vec4 texel = texture2D(u_clusterbuffer, vec2(u, v));
    // }

    int nxtLight = 1;
    int currentLight = int(ExtractFloat(u_clusterbuffer, imageWidth, imageHeight, iFrustum, nxtLight));
    for (int i = 0; i < ${params.numLights}; ++i) {
      if (currentLight == i) {
        Light light = UnpackLight(i);
        float lightDistance = distance(light.position, v_position);
        vec3 L = (light.position - v_position) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

        if (nxtLight < lightsPerFrustum) {
          currentLight = int(ExtractFloat(u_clusterbuffer, imageWidth, imageHeight, iFrustum, ++nxtLight));
        } else {
          break;
        }
      }
    }

    // for (int i = 0; i < ${params.numLights}; ++i) {
    //   Light light = UnpackLight(i);
    //   float lightDistance = distance(light.position, v_position);
    //   vec3 L = (light.position - v_position) / lightDistance;

    //   float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
    //   float lambertTerm = max(dot(L, normal), 0.0);

    //   fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    // }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
