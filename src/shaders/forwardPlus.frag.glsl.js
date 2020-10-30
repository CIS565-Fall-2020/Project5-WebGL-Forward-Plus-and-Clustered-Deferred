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

  //Add the new uniforms 
  uniform mat4 u_viewMatrix;  
  uniform float u_nearClip; 
  uniform float u_farClip; 
  uniform float u_height; 
  uniform float u_width; 
  uniform vec3 u_camPos; 
  uniform int u_xSlices; 
  uniform int u_ySlices; 
  uniform int u_zSlices; 
  uniform int u_maxLightsPerCluster; 
  uniform int u_pixelsPerElem;
  uniform int u_texElemCount;

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

    //Bring point to camera space 
    vec4 transformedPos = u_viewMatrix * vec4(v_position, 1.0); 
    float depth = 50.0 - u_nearClip; 

    //cluster indices about x, y and z
    int cl_X = int(floor(gl_FragCoord.x * float(u_xSlices) / u_width)); 
    int cl_Y = int(floor(gl_FragCoord.y * float(u_ySlices) / u_height)); 
    int cl_Z = int((-transformedPos.z - u_nearClip) * float(u_zSlices) / depth); 

    int clusterIdx_1D = int(cl_X + (u_xSlices * cl_Y) + (u_xSlices * u_ySlices * cl_Z)); 
    int pixPerElem = int(float(u_maxLightsPerCluster + 1) / 4.0) + 1; 
    int numLights = int(ExtractFloat(u_clusterbuffer, u_texElemCount, u_pixelsPerElem, clusterIdx_1D, 0));

    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= numLights)
      {
        break; 
      }
      int l = int(ExtractFloat(u_clusterbuffer, u_texElemCount, u_pixelsPerElem, clusterIdx_1D, i + 1)); 
      Light light = UnpackLight(l);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      //Blinn Phong 
      vec3 lightToCam = normalize(light.position - u_camPos); 
      vec3 pointToCam = normalize(v_position - u_camPos); 
      vec3 lightToPoint = normalize(lightToCam + pointToCam);      
      float specularIntensity = max(pow(dot(lightToPoint, normal), 5.0), 0.0); 

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      fragColor += (specularIntensity * light.color * 0.01); 
    }
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}