# MIT License

# Copyright (c) 2021 Jay Blunt

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import sys, os, re
import logging, inspect
import pprint as pp
import configparser
import argparse
import enum
import functools, itertools
import simplejson as json
import sqlalchemy
import sqlalchemy.ext.declarative
import sqlalchemy.pool




class OutputFormat(enum.Enum):
    JSON = 1
    CSV = 2
    TXT = 3

    @classmethod
    def map(self, input):
        if input == "json":
            return OutputFormat.JSON
        elif input == "csv":
            return OutputFormat.CSV
        elif input == "txt":
            return OutputFormat.TXT




class DB(object):

    __tables__ = dict(
        {
            "InventoryTypes": "invTypes",
            "InventoryGroups": "invGroups",
            "InventoryMetaGroups": "invMetaGroups",
            "InventoryCategories": "invCategories",
            "InventoryTypeMaterials": "invTypeMaterials",
            "IndustryActivityProducts": "industryActivityProducts",
            "IndustryActivityMaterials": "industryActivityMaterials",
        }
    )

    __table_args__ = dict(
        {
            "IndustryActivityProducts": (
                sqlalchemy.Column(
                    "typeID", sqlalchemy.INTEGER(), index=True, primary_key=True
                ),
                sqlalchemy.Column("activityID", sqlalchemy.INTEGER(), primary_key=True),
                sqlalchemy.Column(
                    "productTypeID", sqlalchemy.INTEGER(), index=True, primary_key=True
                ),
                sqlalchemy.Column("quantity", sqlalchemy.INTEGER()),
            ),
            "IndustryActivityMaterials": (
                sqlalchemy.Column(
                    "typeID", sqlalchemy.INTEGER(), index=True, primary_key=True
                ),
                sqlalchemy.Column("activityID", sqlalchemy.INTEGER(), primary_key=True),
                sqlalchemy.Column(
                    "materialTypeID", sqlalchemy.INTEGER(), primary_key=True
                ),
                sqlalchemy.Column("quantity", sqlalchemy.INTEGER()),
            ),
        }
    )

    InventoryTypes = type("InventoryTypes", (object,), {})
    InventoryGroups = type("InventoryGroups", (object,), {})
    InventoryMetaGroups = type("InventoryMetaGroups", (object,), {})
    InventoryCategories = type("InventoryCategories", (object,), {})
    InventoryTypeMaterials = type("InventoryTypeMaterials", (object,), {})
    IndustryActivityProducts = type("IndustryActivityProducts", (object,), {})
    IndustryActivityMaterials = type("IndustryActivityMaterials", (object,), {})

    def __init__(self, configuration, enable_echo=False):
        self.schema = configuration.get("schema")
        self.engine = sqlalchemy.create_engine(
            configuration.get("db"),
            poolclass=sqlalchemy.pool.QueuePool,
            pool_pre_ping=True,
            echo=enable_echo,
        )
        if self.schema:
            self.engine = self.engine.execution_options(
                schema_translate_map={None: self.schema}
            )
        self.metadata = sqlalchemy.MetaData(bind=self.engine)
        for table in [
            self.InventoryTypes,
            self.InventoryGroups,
            self.InventoryCategories,
            self.InventoryTypeMaterials,
            self.IndustryActivityMaterials,
            self.IndustryActivityProducts,
        ]:
            args = self.__table_args__.get(table.__name__, list())
            sqlalchemy.orm.mapper(
                table,
                sqlalchemy.Table(
                    self.__tables__[table.__name__],
                    self.metadata,
                    autoload_with=self.engine,
                    *args
                ),
            )
        self.session = sqlalchemy.orm.sessionmaker(bind=self.engine)()




class QueryWrapper(object):
    def __init__(self, db):
        self._db = db

    def typeids_to_namedict(self, typeids):
        db = self._db
        d = dict()
        for o in (
            db.session.query(db.InventoryTypes)
            .filter(db.InventoryTypes.published == 1)
            .filter(db.InventoryTypes.typeID.in_(typeids))
            .all()
        ):
            d[o.typeID] = o.typeName
        return d

    def groupids_to_namedict(self, groupids):
        db = self._db
        d = dict()
        for o in (
            db.session.query(db.InventoryGroups)
            .filter(db.InventoryGroups.published == 1)
            .filter(db.InventoryGroups.groupID.in_(groupids))
            .all()
        ):
            d[o.groupID] = o.groupName
        return d

    def groupnames_to_groupids(self, groupnames):
        db = self._db
        return set(
            map(
                lambda x: x.groupID,
                db.session.query(db.InventoryGroups)
                .filter(db.InventoryGroups.published == 1)
                .filter(db.InventoryGroups.groupName.in_(groupnames))
                .all(),
            )
        )

    def groupids_to_typeids(self, groupids, metagroups=[]):
        db = self._db
        shipids = set()
        for o in (
            db.session.query(db.InventoryTypes)
            .filter(db.InventoryTypes.published == 1)
            .filter(db.InventoryTypes.groupID.in_(groupids))
            .all()
        ):
            # meta = (len(metagroups) > 0 and o.metaGroupID in metagroups) or True
            meta = True
            if meta and o.raceID not in [135]:
                shipids.add(o.typeID)
        return shipids

    def names_to_typeids(self, names):
        db = self._db
        typeids = set()
        for o in (
            db.session.query(db.InventoryTypes)
            .filter(db.InventoryTypes.published == 1)
            .filter(db.InventoryTypes.typeName.in_(names))
            .all()
        ):
            typeids.add(o.typeID)
        return typeids

    def typeids_to_blueprints(self, typeids):
        db = self._db
        blueprints = dict()
        for o in (
            db.session.query(db.IndustryActivityProducts)
            .filter(db.IndustryActivityProducts.productTypeID.in_(typeids))
            .all()
        ):
            blueprints[o.typeID] = o.productTypeID
        return blueprints

    def blueprints_to_requirements(self, blueprints):
        db = self._db
        requirements = dict()
        for o in (
            db.session.query(db.IndustryActivityMaterials)
            .filter(db.IndustryActivityMaterials.activityID == 1)
            .filter(db.IndustryActivityMaterials.typeID.in_(set(blueprints.keys())))
            .filter(db.IndustryActivityMaterials.quantity > 0)
            .all()
        ):
            productID = blueprints[o.typeID]
            if not requirements.get(productID):
                requirements[productID] = dict()
            requirements[productID][o.materialTypeID] = o.quantity
        return requirements

    def ore_yields(self):
        db = self._db

        ore_category_subquery = (
            db.session.query(db.InventoryCategories.categoryID)
            .filter(db.InventoryCategories.published)
            .filter(db.InventoryCategories.categoryName == "Asteroid")
        )

        ore_group_subquery = (
            db.session.query(db.InventoryGroups.groupID)
            .filter(db.InventoryGroups.categoryID.in_(ore_category_subquery))
            .filter(db.InventoryGroups.published)
        )

        ore_type_subquery = (
            db.session.query(db.InventoryTypes.typeID)
            .filter(db.InventoryTypes.groupID.in_(ore_group_subquery))
            .filter(db.InventoryTypes.published)
        )

        ore_mineral_yield = dict()
        for o in (
            db.session.query(db.InventoryTypeMaterials)
            .filter(db.InventoryTypeMaterials.typeID.in_(ore_type_subquery))
            .all()
        ):
            if not ore_mineral_yield.get(o.typeID):
                ore_mineral_yield[o.typeID] = dict()
            ore_mineral_yield[o.typeID][o.materialTypeID] = o.quantity
        return ore_mineral_yield




class Defaults(object):

    region_info = {
            "10000002": { "regionName": "The Forge" },
            "10000032": { "regionName": "Sinq Laison" },
            "10000043": { "regionName": "Domain" },
            "10000030": { "regionName": "Heimatar" }
    }

    station_info = {
        "60003760": {
            "regionID": 10000002,
            "stationName": "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
        },
        "60011866": {
            "regionID": 10000032,
            "stationName": "Dodixie IX - Moon 20 - Federation Navy Assembly Plant",
        },
        "60008494": {
            "regionID": 10000043,
            "stationName": "Amarr VIII (Oris) - Emperor Family Academy",
        },
        "60004588": {
            "regionID": 10000030,
            "stationName": "Rens VI - Moon 8 - Brutor Tribe Treasury",
        },
    }

    skip_item_names = [
        "Cambion",
        "Utu",
        "Guardian-Vexor",
        "Stratios Emergency Responder",
        "Victorieux Luxury Yacht",
        "Adrestia",
        "Mimir",
        "Maelstrom",
        "Bowhead",
        "Caiman",
        "Chemosh",
        "Astero",
        "Stratios",
        "Nestor",
        "Sunesis",
        "Gnosis",
        "Praxis",
    ]

    build_item_group_names = [
        "Frigate",
        "Assault Frigate",
        "Interceptor",
        "Logistics Frigate",

        "Destroyer",
        "Interdictor",
        "Tactical Destroyer",
        "Command Destroyer",

        "Cruiser",
        "Heavy Assault Cruiser",
        "Electronic Attack Ship",
        "Logistics",

        "Combat Battlecruiser",
        "Attack Battlecruiser",

        # "Battleship",

        "Freighter",
        "Dreadnought",
        "Capital Construction Components"
    ]




def sorted_ores(orenames, name_to_id):
    stub_to_names = dict()
    stub_to_root = dict()
    for n in orenames:
        na = n.split()
        if na[0] != "Compressed":
            continue

        stub = na[-1]
        if len(na) == 2 or (stub == "Ochre" and na[-2] == "Dark"):
            stub_to_root[stub] = n
        elif len(na) == 3:
            stub_names = stub_to_names.get(stub, [])
            if len(stub_names) == 0:
                stub_to_names[stub] = stub_names
            if n not in stub_names:
                stub_names.append(n)

    sorted_oreids = list()
    for stub in sorted(stub_to_root.keys()):
        sorted_oreids.append([name_to_id[stub_to_root[stub]], True])
        for name in sorted(stub_to_names[stub]):
            sorted_oreids.append([name_to_id[name], False])

    return sorted_oreids




parser = argparse.ArgumentParser()
parser.add_argument(
    "-c",
    "--config",
    dest="config",
    default=os.path.join(os.path.dirname(os.path.realpath(__file__)), "evesde.cfg"),
    help="specify config file",
    metavar="FILE",
)
parser.add_argument(
    "-d", "--debug", dest="debug", action="store_true"
)
parser.add_argument(
    "-f", "--format", dest="format", default="json", choices=["json", "csv", "txt"]
)
parser.add_argument(
    "-o", "--output", dest="output", default="data"
)

args = parser.parse_args()
output_format = OutputFormat.map(args.format)

config = configparser.ConfigParser()
config.read(os.path.join(os.path.dirname(os.path.realpath(__file__)), "evesde.cfg"))

db = DB(config["evesde"], enable_echo=False)




wrapper = QueryWrapper(db)

build_groupids = wrapper.groupnames_to_groupids(Defaults.build_item_group_names)


build_typeids = wrapper.groupids_to_typeids(build_groupids)

# Manually remove some .. bad yamlloader data
skip_item_typeids = wrapper.names_to_typeids(Defaults.skip_item_names)
skip_item_names = set([v for k, v in wrapper.typeids_to_namedict(skip_item_typeids).items()])
skip_missed_names = skip_item_names.symmetric_difference(set(Defaults.skip_item_names))
if len(skip_missed_names) > 0:
    print(skip_missed_names)
    exit(-1)

build_typeids = build_typeids - skip_item_typeids



# ids for Minerals 
mineral_typeids = set(wrapper.groupids_to_typeids(
    wrapper.groupnames_to_groupids(["Mineral"]), [0]
))
print()
print("mineral_typeids:{}".format(sorted(list(mineral_typeids))))


# ids for Capital Construction Components
capital_component_typeids = set(wrapper.groupids_to_typeids(
    wrapper.groupnames_to_groupids(["Capital Construction Components"]), [0]
))
print()
print("capital_component_typeids:{}".format(sorted(list(capital_component_typeids))))



mineral_only_itemids = set()
capital_component_only_itemids = set()

required_mineral_typeids = set()
required_capital_component_typeids = set()

all_item_requirements = dict()
all_ids = set()

# Collect all item requirements
outstanding_items = set(build_typeids)
while len(outstanding_items) > 0:
    new_ids = set()
    item_blueprints = wrapper.typeids_to_blueprints(outstanding_items)
    item_requirements = wrapper.blueprints_to_requirements(item_blueprints)
    for k, v in item_requirements.items():
        if k not in all_item_requirements.keys():
            all_item_requirements[k] = v
        v_keys = set(v.keys())
        new_ids = new_ids.union(v_keys)
        if k in build_typeids:
            if v_keys.issubset(mineral_typeids):
                mineral_only_itemids.add(k)
                required_mineral_typeids = required_mineral_typeids.union(v_keys)
            elif v_keys.issubset(capital_component_typeids):
                capital_component_only_itemids.add(k)
                required_capital_component_typeids = required_capital_component_typeids.union(v_keys)
    # print("{} -> {}".format(len(outstanding_items), len(new_ids)))
    all_ids = all_ids.union(outstanding_items).union(new_ids)
    outstanding_items = new_ids

# Only include what is actually required, not everything in the group
mineral_typeids = required_mineral_typeids
capital_component_typeids = required_capital_component_typeids

print()
print("mineral_typeids:{}".format(sorted(list(mineral_typeids))))
print("capital_component_typeids:{}".format(sorted(list(capital_component_typeids))))

print()
print("mineral_only_itemids:{}".format(sorted(list(mineral_only_itemids))))
print("all_item_requirements:{}".format(len(all_item_requirements.keys())))
print("all_requirement_ids:{}".format(len(all_ids)))




## Which ores *only* yield minerals
ore_yields = wrapper.ore_yields()

mineral_only_oreids = set()
all_ore_yield_typeids = set()
for k, v in ore_yields.items():
    all_ore_yield_typeids = all_ore_yield_typeids.union(set(v.keys()))
    if set(v.keys()).issubset(mineral_typeids):
        mineral_only_oreids.add(k)



# Item and Group info
for s in [all_item_requirements.keys(), ore_yields.keys(), all_ore_yield_typeids, mineral_typeids]:
    all_ids = all_ids.union(s)    

print("all_ids:{}".format(len(all_ids)))

print()
print("Item Info:")
item_info = dict()
item_groupids = set()

for o in (
    db.session.query(db.InventoryTypes)
    .filter(db.InventoryTypes.typeID.in_(all_ids))
    .all()
):
    item_info[o.typeID] = {
        "n": o.typeName,
        "v": "{:.2f}".format(o.volume),
        "pv": "{:.2f}".format(o.packagedVolume),
        "gid": o.groupID,
    }
    item_groupids.add(o.groupID)

group_info = dict()
for k, v in wrapper.groupids_to_namedict(item_groupids).items():
    group_info[k] = { 'n': v }



# Order the ids in the order we want to present them. THe UI just renders the items in the order
# they appear in this data
groupid_to_typeids_cache = dict()
groupname_to_groupid = {v: k for k, v in wrapper.groupids_to_namedict(build_groupids).items()}
groupid_to_groupname = {v: k for k, v in groupname_to_groupid.items()}
ordered_build_groupids = ([groupname_to_groupid[x] for x in Defaults.build_item_group_names])
groupid_to_typeids_cache[groupname_to_groupid["Capital Construction Components"]] = capital_component_typeids

ordered_mineral_build_typeids = list()
orderd_all_shipids = list()

for groupid in ordered_build_groupids:
    group_typeids = groupid_to_typeids_cache.get(groupid)
    if not group_typeids:
        group_typeids = wrapper.groupids_to_typeids([groupid])

    if len(group_typeids) == 0:
        continue

    group_itemname_to_itemid = wrapper.typeids_to_namedict(group_typeids)
    group_itemname_to_itemid = {v:k for k, v in group_itemname_to_itemid.items()}

    sorted_itemnames = sorted(group_itemname_to_itemid.keys())
    sorted_itemids = [group_itemname_to_itemid[x] for x in sorted_itemnames]

    print()
    print("{}: {}".format(groupid, sorted_itemids))
    print("{}: {}".format(groupid_to_groupname[groupid], sorted_itemnames))

    for itemname in sorted_itemnames:
        tmp_itemid = group_itemname_to_itemid[itemname]
        if tmp_itemid in mineral_only_itemids.union(capital_component_only_itemids):
            ordered_mineral_build_typeids.append(tmp_itemid)
        orderd_all_shipids.append(tmp_itemid)

print()
print("{}:{}".format('ordered_mineral_build_typeids', ordered_mineral_build_typeids))



# Order the mineral ids in the order we want to present them
orenames_to_oreids = {v: k for k, v in wrapper.typeids_to_namedict(mineral_only_oreids).items()}
compressed_orenames = [x for x in filter(lambda x: x.split()[0] == "Compressed", orenames_to_oreids.keys())]
sorted_mineral_oreids = sorted_ores(compressed_orenames, orenames_to_oreids)
ordered_mineral_oreids_stubs = [y for y in map(lambda x: x[0], [x for x in filter(lambda x: x[1], sorted_mineral_oreids)])]
ordered_mineral_oreids_list = [y for y in map(lambda x: x[0], [x for x in filter(lambda x: True, sorted_mineral_oreids)])]



with open("{:s}.{:s}".format(args.output, args.format), "w") as ofp:
    if OutputFormat.JSON == output_format:
        o = {
            "itemInfo": item_info,
            "groupInfo": group_info,
            "itemYields": ore_yields,
            "itemRequirements": all_item_requirements,
            "shipIds": list(orderd_all_shipids),
            "mineralBuildIds": list(ordered_mineral_build_typeids),
            "mineralOreIds": list(ordered_mineral_oreids_list),
            "mineralOreStubIds": list(ordered_mineral_oreids_stubs),
            "mineralIds": list(mineral_typeids),
            "stationInfo": Defaults.station_info,
            "regionInfo": Defaults.region_info
        }
        json.dump(o, ofp)

