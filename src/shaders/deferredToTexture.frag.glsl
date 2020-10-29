#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec3 v_projection_position;

vec2 signNotZero(vec2 v){
    vec2 o;
    o.x = (v.x >= 0.0) ? 1.0 : -1.0;
    o.y = (v.y >= 0.0) ? 1.0 : -1.0;
    return o;
}

vec2 float32x3_to_oct(vec3 v){
    vec2 o;
    vec2 p = v.xy * (1.0 / (abs(v.x) + abs(v.y) + abs(v.z) + 0.00001));

    return (v.z <= 0.0) ? ( vec2(1.0) - abs(p.yx) ) * signNotZero(p) : p;
}

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // TODO: populate your g buffer
    // //if optimize
    //vec2 vec2Normal = float32x3_to_oct(norm);
    gl_FragData[0] = vec4(v_position, 1);
    gl_FragData[1] = vec4(norm, 0);
    gl_FragData[2] = vec4(col, 1);
    gl_FragData[3] = vec4(v_projection_position ,1);
}