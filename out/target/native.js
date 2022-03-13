"use strict";Object.defineProperty(exports, "__esModule", {value: true});// Target abstract machine




 class TargetMachine {
    // general info
    





















































} exports.TargetMachine = TargetMachine;

 const targettingRegistry = new Map(); exports.targettingRegistry = targettingRegistry
 function getTargetForName(name) {
    if (!exports.targettingRegistry.has(name)) {
        console.error('ERROR: no such target: %s', name)
        process.exit(1)
    }
    return exports.targettingRegistry.get(name)()
} exports.getTargetForName = getTargetForName;
