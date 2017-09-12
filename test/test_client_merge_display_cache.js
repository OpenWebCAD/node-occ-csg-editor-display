const util = require("util");
const should = require("should");
const async = require("async");
const _ = require("underscore");

const geometry_editor = require("node-occ-csg-editor");
const calculate_display_info = require("../server/calculate_display_info").calculate_display_info;

const merge_display_cache = require("../client/merge_display_cache").merge_display_cache;

/**
 *
 * @param geometryEditor
 * @param cache
 * @param cache.displayCache {null|Object} the display cache returned by the previous call of
 * @param callback
 */
function calculate_display_info_as_rest_api(geometryEditor, cache, callback) {

    const visibleItems = geometryEditor.items.filter(a=> a.isVisible);
    const subset =  geometryEditor.extractSubset(visibleItems);
    subset.should.be.instanceof(geometry_editor.GeometryEditor);

    //xx    console.log(geometryEditor.convertToScript());
    //xx    console.log('sss')
    console.log(subset.convertToScript());

    if (!_.isFunction(callback)) {
        throw new Error("Expecting a callback");
    }
    const data = geometry_editor.GeometryEditor.serialize(subset);

    data.should.not.match(/displayCache/,"displayCache is not serialized in geometryEditor");

    //xx console.log(data);

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
        const s = g.items[2];
        b.isVisible.should.eql(true);
        c.isVisible.should.eql(true);
        s.isVisible.should.eql(true);

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
        const b = g.items[0]; // box
        const c = g.items[1]; // cylinder
        const s = g.items[2]; // shape (cut)

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
            function step3_b_and_c_become_invisible(callback) {
                // change cylinder
                b.visible = false;
                c.visible = false;
                s.visible = false;

                calculate_display_info_as_rest_api(g, the_cache, function (err, result) {

                    console.log("displayCache", result.displayCache);
                    //xx console.log("result", _.map(the_cache.meshes,(v)=>(" " + v.generation)).join(" | "));
                    the_cache = merge_display_cache(the_cache, result.displayCache, result.meshes);

                    the_cache.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
                    the_cache.displayCache[c._id].hash.should.eql("d82e0c04fd26534fbb03183370993fa194fa3179");

                    Object.keys(the_cache.displayCache).length.should.eql(3);
                    Object.keys(the_cache.meshes).length.should.eql(3);

                    callback(err);
                });
            }


        ], done);
    });

});

describe("calculating from base64 packed geometry",function() {

    let geometry;
    before(function(done){
        //xx const base64Data = "eJy9j71uwzAMhN+FswbJSf+8FkHHZiraBoahWATKoJYESS5SBHr30oHsZPDQKdvp9N2R3O1O0EENL+h6TOF3Yyi5AAIM1CeghH0chYaaQQe1yk0W0LadG2zCALXkl9dBcxrDzDY5Z3Fp3gbqKdEPPjuLU7nlDP/HL+1Rstka9GgN2o7wXMTjqnEYMa4EUHyjSPtvDqUwoADvyCZVyBWTQRsa4uQ85IJUxXickclR1WXP1/0Bu1SWm93N0QeMkZzdjlXT7u+lYM2VH0Xfsf4s+j4vNExhPHr2JdwIUdUSs3jO09U5Sl7do9StDlLyH9BqzUwjzqvJ3PwByyHbnQ==";
        const base64Data = "eJy9j71uwzAMhN+FswbJSf+8FkHHZiraBoahWATKoJYESS5SBHr30oHsZPDQKdvp9N2R3O1O0EENL+h6TOF3Yyi5AAIM1CeghH0chYaaQQe1yk0W0LadG2zCALXkl9dBcxrDzDY5Z3Fp3gbqKdEPPjuLU7nlDP/HL+1Rstka9GgN2o7wXMTjqnEYMa4EUHyjSPtvDqUwoADvyCZVyBWTQRsa4uQ85IJUxXickclR1WXP1/0Bu1SWm93N0QeMkZzdjlXT7u+lYM2VH0Xfsf4s+j4vNExhPHr2JdwIUdUSs3jO09U5Sl7do9StDlLyH9BqzUwjzqvJ3PwByyHbnQ==";

        const data = new Buffer(base64Data, "base64");
        geometry_editor.GeometryEditor.deserializeZ(data,function(err,_geometry){
            geometry = _geometry;
            done(err);
        });

    });

    it("should",function(done) {
        console.log(geometry.convertToScript());
        done();
    });
})
