#version 100
#extension GL_EXT_draw_buffers: enable
#define INVPI 0.31830988618
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;
uniform mat4 u_viewMat;

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

// Octahedron-normal
// https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/

vec2 signNotZero(vec2 v)
{
    return vec2((v.x >= 0.0) ? 1.0 : -1.0, (v.y >= 0.0) ? 1.0 : -1.0);
}

vec2 encodeNormal(vec3 v)
{
    vec2 p = vec2(v) * (1.0 / (abs(v.x) + abs(v.y) + abs(v.z)));
    return (v.z <= 0.0) ? ((1.0 - vec2(abs(p.y), abs(p.x))) * signNotZero(p)) : p;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));
    vec3 pos = v_position;

    // TODO: populate your g buffer
    // Normal and Depth
    //gl_FragData[0] = vec4(norm, v_position.z);

    // Optimized normal
    vec2 encodedNormal = encodeNormal(norm);
    gl_FragData[0] = vec4(encodedNormal.xy, v_position.z, 0.0);

    // Color
    gl_FragData[1] = vec4(col, 1.0);

    // Pos
    //gl_FragData[2] = vec4(pos, 1.0);
}