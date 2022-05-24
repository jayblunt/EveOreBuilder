# Eve Online Ore Estimator

[TypeScript](https://github.com/microsoft/TypeScript) browser-based implementation of Eve Online Minerals calcuation and Ore estimation based on live market prices.
Requires a dump of the Eve SDE from [@fuzzysteve](https://github.com/fuzzysteve/yamlloader) (available at [www.fuzzwork.co.uk/dump/](https://www.fuzzwork.co.uk/dump/)) and the [Linear Programming Solver](https://github.com/JWally/jsLPSolver) from [@JWally](https://github.com/JWally).
A minimal TypeScript stub for the solver is included.

See [https://www.castabouts.net/](https://www.castabouts.net/) for a running example.

### Supported Ship Types
- T1 and Faction ships that can be built entirely from base minerals
- ~~Capitals that can be built entirely from Capital Construction Components (which can be built entirely from base minerals)~~ - 2021/04 Industry changes broke this..

## Data Preparation

The repo contains (in the python subdirectory) a python script for generating the required data from the Eve SDE dump.

It requries a config file for DB access - this can be the same config file as used in the [@fuzzysteve](https://github.com/fuzzysteve/yamlloader) repo.

The UI App content and ship ordering is driven entirely by the output of the python generator. 

To include / exclude ships to ship groups, or to change the presentation order of the UI, change the output of the python generator.

The output of the python script is ```data.json```. This will need to be moved up into the ```content``` directory of the repo in order to be picked up by the application.

## Linear Programming Solver

This will need adding into the tree under ```external/solver```.

This example presumes the solver is bundled, but it can also be loaded separately in the brower.

## Running the application

With solver in place and the application built, open a brower at the root of the repo.

-- Jay Blunt

