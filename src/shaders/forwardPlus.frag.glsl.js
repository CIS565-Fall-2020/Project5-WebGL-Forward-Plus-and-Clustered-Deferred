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
  uniform vec2 u_clusterbufferDimension;

  uniform vec3 u_slicesCount;
  uniform vec2 u_canvasDimension;
  uniform mat4 u_viewProjectionMatrix;
  uniform mat4 u_viewProjectionMatrixInverse;
  uniform float u_cameraNearClip;
  uniform float u_cameraFarClip;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
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

  // From pixel space to world space
  vec3 pixelSpaceToWorldSpace(vec2 pixel, float distance) {
    vec4 res = vec4(pixel.x, pixel.y, distance, distance);

    // Pixel space to homogenized screen space
    res.x = (res.x / u_canvasDimension.x) * 2.0 - 1.0;
    res.y = 1.0 - (res.y / u_canvasDimension.y) * 2.0;

    // Homogenized screen space to unhomogenized screen space
    res.x *= distance;
    res.y *= distance;

    // Unhomogenized screen space to world space
    res = u_viewProjectionMatrixInverse * res;
    return res.xyz;
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);
    vec3 fragColor = vec3(0.0);

    // Need to somehow determine the cluster for this fragment -------------------
    int frustumCount = int(u_slicesCount.x * u_slicesCount.y * u_slicesCount.z);
    vec3 frustum = vec3(0.0);
    
    // Determine slice x and y
    frustum.x = floor(u_slicesCount.x * gl_FragCoord.x / u_canvasDimension.x);
    frustum.y = floor(u_slicesCount.y * gl_FragCoord.y / u_canvasDimension.y);
    
    // Find the far clip and near clip point and near clip point
    vec3 nearClip = pixelSpaceToWorldSpace(gl_FragCoord.xy, u_cameraNearClip);
    vec3 farClip = pixelSpaceToWorldSpace(gl_FragCoord.xy, u_cameraFarClip);
    frustum.z = floor(u_slicesCount.z * distance(v_position, nearClip) / distance(farClip, nearClip));

    int frustumIndex = int((frustum.x + frustum.y * u_slicesCount.x + frustum.z * u_slicesCount.x * u_slicesCount.y) / float(frustumCount));
  
    // Get the number of light stored in this frustum
    int lightCount = int(ExtractFloat(u_clusterbuffer, frustumCount, ${params.clusterBufferTextureHeight}, frustumIndex, 0));
    
    for (int i = 1; i <= ${params.maxLightsPerCluster}; ++i) {
      int lightIndex = int(ExtractFloat(u_clusterbuffer, frustumCount, ${params.clusterBufferTextureHeight}, frustumIndex, i));

      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);

    //TEST ONLY
    //gl_FragColor = vec4(frustum.x / u_slicesCount.x, frustum.y / u_slicesCount.y, 0.0, 1.0);
    gl_FragColor = vec4(frustum.z, frustum.z, frustum.z * 100.0, 1.0);
  }
  `;
}
