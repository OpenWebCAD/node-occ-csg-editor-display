const nodeocc = require("node-occ");
const assert = require("assert");
const _ =require("underscore");
const geometry_editor = require("node-occ-csg-editor");

const occ = nodeocc.occ;
const shapeFactory = nodeocc.shapeFactory;
const scriptRunner = nodeocc.scriptRunner;
const fast_occ = nodeocc.fastBuilder.occ;
const chalk = require('chalk');
const doDebug = false;

function buildResponse(cacheBefore, data, logs) {

    assert(data instanceof Array);

    const displayCache = {};
    const meshes = {};

    let response = {solids: [], logs: []};
    let counter = 1;
    data.forEach(function (dataItem) {

        if (dataItem.err) {

            displayCache[dataItem.id] = {err: dataItem.err.message};

        } else {

            const shape = dataItem.shape;

            if (cacheBefore[shape._id] && cacheBefore[shape._id].hash === shape.uuid) {
                // object has not changed, and is already on client side
                displayCache[dataItem.id] = {hash: shape.uuid, err: null};
                meshes[dataItem.id] = {mesh: "reuse"};
                return;
            }

            assert(shape._id);
            counter++;
            try {
                shape.name = "id_" + shape._id;
                let mesh = occ.buildSolidMesh(shape);
                displayCache[dataItem.id] = {hash: shape.uuid, err: null};
                meshes[dataItem.id] = {mesh: mesh};

            }
            catch (err) {
                //Xx console.log(" meshing shape  ", shape._id ," has failed with error ",err.message);
                displayCache[dataItem.id] = {hash: shape.uuid, err: err.message};
                meshes[dataItem.id] = {mesh: null};
            }

        }

    });
    response.logs = logs;
    response.displayCache = displayCache;
    response.meshes = meshes;
    return response;
}


function convertToScriptEx(geometryEditor) {

    const context = {};

    function convertItemToScript(item) {

        let str = "var " + item.name + ";\n";
        str += "try {\n";
        str += "    " + item.name + " = " + item.toScript(context);
        if (item.isVisible) {
            str += "\n    display(" + item.name + "," + item._id + ");\n";
        }
        str += "} catch(err) {\n";
        str += `   console.log('building ${item.name} has failed');\n`;
        str += "   reportError(err," + item._id + ");\n";
        str += "}\n";

        return str;
    }

    function convertParameterToScript(param) {
        const value = ( param.value === null || param.value === undefined ) ? param.defaultValue : param.value;
        return "var $" + param.id + " = " + value + ";"
    }

    let lines = [];
    const parameters = geometryEditor.getParameters();
    lines = lines.concat(parameters.map(convertParameterToScript));
    lines = lines.concat(geometryEditor.items.map(convertItemToScript));
    return lines.join("\n");
}


function calculate_display_info(geometryEditor, callback) {


    if (!_.isFunction(callback)) {
        throw new Error("Expecting a callback");
    }
    geometryEditor.displayCache = geometryEditor.displayCache || {};


    const displayCache = geometryEditor.displayCache || {};
    const script = convertToScriptEx(geometryEditor);
    if (doDebug) {
        console.log("script =  \n" + chalk.yellow(script));
    }


    const runner = new scriptRunner.ScriptRunner({
        csg: fast_occ,
        occ: fast_occ,

        data: [],

        display: function (shape, metaData) {

            if (typeof(metaData) !== "number") {
                throw new Error("Internal Error");
            }
            if (!shape instanceof occ.Solid) {
                throw new Error("Internal Error");
            }
            shape._id = metaData;
            runner.env.data.push({shape: shape, id: metaData, hash: shape.hash});
        },
        reportError: function (err, metaData) {
            //xx console.log("report err =",err);
            runner.env.data.push({shape: null, id: metaData, hash: null, err: err});
        },
        shapeFactory: shapeFactory
    });
    const solidBuilderScript = "" + script + "";

    runner.run(solidBuilderScript,
      function done_callback() {
          const response = buildResponse(displayCache, runner.env.data, runner.env.logs);

          geometryEditor.displayCache = response.displayCache;
          callback(null, response);
      },
      function error_callback(err) {
          console.log("---------------------------------------------------------------------------- ERROR", err);
          callback(err);
      }
    );

}

module.exports.calculate_display_info = calculate_display_info;
