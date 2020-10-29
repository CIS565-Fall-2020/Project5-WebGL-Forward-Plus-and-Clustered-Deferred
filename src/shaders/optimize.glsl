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

vec3 oct_to_float32x3(vec2 e){
    vec3 v = vec3(e.xy, 1.0 - abs(e.x) - abs(e.y));
    if (v.z < 0.0){
        v.xy = ( vec2(1.0) - abs(v.yx) ) * signNotZero(v.xy);
    }
    return normalize(v);
}