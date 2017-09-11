const util = require("util");
const should = require("should");
const async = require("async");
const _ = require("underscore");

const geometry_editor = require("node-occ-csg-editor");
const calculate_display_info = require("../server/calculate_display_info").calculate_display_info;

const merge_display_cache = require("../client/merge_display_cache").merge_display_cache;

/**
 *
 * @param b
 * @param cache
 * @param cache.displayCache {null|Object} the display cache returned by the previous call of
 * @param callback
 */
function calculate_display_info_as_rest_api(b, cache, callback) {

    if (!_.isFunction(callback)) {
        throw new Error("Expecting a callback");
    }
    const data = geometry_editor.GeometryEditor.serialize(b);

    data.should.not.match(/displayCache/);

    const bb = geometry_editor.GeometryEditor.deserialize(data);
    bb.displayCache = cache.displayCache;
    calculate_display_info(bb, callback);
}

describe("it should maintain a display cache up to date", function () {


    function geometry() {
        const g = new geometry_editor.GeometryEditor();

        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(100, 200, 200);
        b.isVisible = true;

        const c = g.addCylinder();
        c.isVisible = true;
        c.point1.set(50, 50, -10);
        c.point2.set(50, 50, 30);
        c.radius.set(20);

        const s = g.addCutOperation(b, c);
        s.isVisible = true;

        return g;

    }

    it("nominal case: the cache doesn't exist yet", function (done) {

        let the_cache = {};

        const g = geometry();
        const b = g.items[0];
        const c = g.items[1];

        calculate_display_info_as_rest_api(g, the_cache, function (err, result) {

            if (err) {
                return done(err);
            }

            // it should provide a cache entry for shape b
            result.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
            result.meshes[b._id].mesh.should.be.instanceOf(Object);
            should.not.exist(result.displayCache[b._id].err);

            // it should provide a cache entry for shape c
            result.displayCache[c._id].hash.should.eql("5d754c32fa04cbdf95d704103198da616ea194cb");
            result.meshes[c._id].mesh.should.be.instanceOf(Object);
            should.not.exist(result.displayCache[c._id].err);

            // merge display cache should reconstruct and resync the cache
            the_cache = merge_display_cache(the_cache, result.displayCache, result.meshes);

            the_cache.displayCache[b._id].hash.should.eql(result.displayCache[b._id].hash);
            the_cache.displayCache[c._id].hash.should.eql(result.displayCache[c._id].hash);
            the_cache.meshes[b._id].mesh.should.eql(result.meshes[b._id].mesh);
            the_cache.meshes[c._id].mesh.should.eql(result.meshes[c._id].mesh);

            done();
        });

    });
    it("should update  display cache - when cache already exist", function (done) {

        let the_cache = {};

        const g = geometry();
        const b = g.items[0];
        const c = g.items[1];

        async.series([
            function step1(callback) {
                calculate_display_info_as_rest_api(g, the_cache, function (err, result) {
                    if (err) {
                        return callback(err);
                    }
                    // let's get the initial version of the cache
                    the_cache = merge_display_cache(the_cache, result.displayCache, result.meshes);
                    callback(err);
                });
            },
            function step2(callback) {

                // when the cylinder change
                c.radius.set(c.radius.exp + 1);

                // when calculate display info is called
                calculate_display_info_as_rest_api(g, the_cache, function (err, result) {

                    //xx console.log("displayCache", result.displayCache);
                    //xx console.log("result", _.map(the_cache.meshes,(v)=>(" " + v.generation)).join(" | "));

                    // object B has not change so the mesh should not be transmitted (to save band with
                    result.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
                    result.meshes[b._id].mesh.should.eql("reuse");

                    // object C was modified so its mesh should be transmitted
                    result.displayCache[c._id].hash.should.eql("d82e0c04fd26534fbb03183370993fa194fa3179");
                    result.meshes[c._id].mesh.should.be.instanceOf(Object);
                    result.meshes[c._id].mesh.should.not.eql("reuse");
                    should.not.exist(result.displayCache[c._id].err);

                    the_cache = merge_display_cache(the_cache, result.displayCache, result.meshes);


                    the_cache.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
                    the_cache.displayCache[c._id].hash.should.eql("d82e0c04fd26534fbb03183370993fa194fa3179");
                    Object.keys(the_cache.displayCache).length.should.eql(3);

                    //the_cache.
                    callback(err);
                });
            },
            function step3_c_becomes_invisible(callback) {
                // change cylinder
                c.visible = false;

                calculate_display_info_as_rest_api(g, the_cache, function (err, result) {

                    //xx console.log("displayCache", result.displayCache);
                    //xx console.log("result", _.map(the_cache.meshes,(v)=>(" " + v.generation)).join(" | "));
                    the_cache = merge_display_cache(the_cache, result.displayCache, result.meshes);

                    the_cache.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
                    the_cache.displayCache[c._id].hash.should.eql("d82e0c04fd26534fbb03183370993fa194fa3179");
                    Object.keys(the_cache.displayCache).length.should.eql(3);

                    callback(err);
                });
            }


        ], done);
    });

});
