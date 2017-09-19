

function merge_display_cache(cache,displayCache,meshes,options) {

    cache = cache ||{};
    options = options || {};

    cache.counter = cache.counter || 1;
    cache.counter++;

    cache.displayCache = displayCache;
    cache.meshes = cache.meshes ||{};

    // update
    for (let key of Object.keys(meshes))  {
        if (meshes[key].mesh === "reuse") {
            cache.meshes[key].generation = cache.counter;
            continue;
        }
        cache.meshes[key] = meshes[key];
        cache.meshes[key].generation = cache.counter;
    }

    const minGeneration = cache.counter - (options.maxAge  || 1);
    // remove stuff with some generation old
    for (let key of Object.keys(cache.meshes)) {
        const m = cache.meshes[key];
        if (m.generation <= minGeneration) {
            delete cache.meshes[key];
        }
    }
    return cache;
}

exports.merge_display_cache = merge_display_cache;