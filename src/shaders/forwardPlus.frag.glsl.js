export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewProjectionMatrix;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform float u_zDist;

  uniform sampler2D u_clusterbuffer;

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

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // calculate frustum index
    int frustumX = int(gl_FragCoord.x / float(${params.width}) * float(${params.numXSlices}));
    int frustumY = int(gl_FragCoord.y / float(${params.height}) * float(${params.numYSlices}));
    int frustumZ = int((u_viewMatrix * vec4(v_position, 1)).z / u_zDist * float(${params.numZSlices}));
    int frustumIndex = frustumX + frustumY * ${params.numXSlices} + frustumZ * ${params.numXSlices} * ${params.numYSlices};

    int textHeight = int(ceil(float(${params.numLights + 1}) / 4.0));

    int numLights = int(ExtractFloat(u_clusterbuffer,
                                      ${params.numClusters},
                                      textHeight,
                                      frustumIndex,
                                      0));

    for(int i = 0; i < ${params.numLights}; i++) {
      if(i >= numLights) break;
      int lightIndex = int(ExtractFloat(u_clusterbuffer,
                                        ${params.numClusters},
                                        textHeight,
                                        frustumIndex,
                                        i + 1));

      Light light = UnpackLight(lightIndex);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    //////// DEBUGGING COLORS ////////
    // debug the X/Y slices of the frustums
    //fragColor = vec3(0, float(frustumY) / float(${params.numYSlices}), float(frustumX) / float(${params.numXSlices}));
    // debug the Z slices of the frustums (set camera.far to be lower)
    //fragColor = vec3(float(frustumZ) / float(${params.numZSlices}));
    // debug the number of lights
    //fragColor = vec3(float(numLights) / float(${params.numLights}), float(numLights) / float(${params.numLights}), 0);
    //////////////////////////////////
    //fragColor = vec3(float(li));
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
