export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_normap;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform int u_camfar;
  uniform int u_camnear;
  uniform float u_screenwidth;
  uniform float u_screenheight;
  uniform mat4 u_viewMatrix;
  uniform vec3 u_camPos;
  
  varying vec2 v_uv;
  
  #define BLINN 1


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

    vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }


  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    vec3 v_position = gb0.xyz;
    vec3 albedo = gb1.rgb;
    
    // decode
    vec2 enc = vec2(gb0.w, gb1.w);
    vec2 fenc = enc*4.0-2.0;
    float f = dot(fenc,fenc);
    float g = sqrt(1.0 - f/4.0);
    vec3 n;
    n.xy = fenc*g;
    n.z = 1.0 - f/2.0;
    // vec3 normal = clamp(n, -1.0, 1.0);

    vec3 normal = gb2.xyz;


    vec4 camSpacePos = u_viewMatrix * vec4(gb0.xyz, 1);
    float xstep, ystep, zstep;
    int clustx, clusty, clustz;
    xstep = u_screenwidth /  float(${params.xSlices});
    ystep = u_screenheight / float(${params.ySlices});
    zstep = float(u_camfar - u_camnear) / float(${params.zSlices}); // zstep is positive
    float actualz = -1.0 * float(camSpacePos.z);
    float diffz = actualz - float(u_camnear);
    clustz = int(floor(diffz / zstep));

    clustx = int(floor(gl_FragCoord.x / xstep));
    clusty = (${params.ySlices} - 1) - int(floor(gl_FragCoord.y / ystep));

    int clustid = clustx + clusty * ${params.xSlices} + clustz * ${params.xSlices} * ${params.ySlices};
    int clustnum = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    int lightcount = int(ExtractFloat(u_clusterbuffer, clustnum, ${params.componentNum}, clustid, 0));


    vec3 fragColor = vec3(0.0);

    for (int i = 1; i < ${params.numLights}; ++i) {
      if (i > lightcount) {
        break;
      }
      int lightIdx = int(ExtractFloat(u_clusterbuffer, clustnum, ${params.componentNum}, clustid, i));
      Light light = UnpackLight(lightIdx);
      // Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      // lambertTerm is diffuseTerm, rest is diffuseColor

#if BLINN 
      float exp = 10.0;
      vec3 view = normalize(u_camPos - v_position);
      vec4 h = vec4(normalize((view + normalize(L)) / 2.0), 1);
      vec4 w = vec4(normalize(normal), 1);
      float specularIntensity = max(pow(dot(h, w), exp), 0.0);
      fragColor += albedo * light.color * vec3(lightIntensity) * clamp(specularIntensity, 0.0, 1.0);
#endif

    }


    




    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    
  }
  `;
}