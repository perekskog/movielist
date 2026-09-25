#!/usr/bin/env python3
""" Concatenate JSON files

Usage:

    concat input1 input2 output

Args:
    input1  First inputfile
    input2  Second inputfile
    output Outputfile
"""

import sys
import json
from datetime import datetime


def datetime_parser(json_dict):
    for (key, value) in json_dict.items():
        try:
            json_dict[key] = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S')
        except (ValueError, AttributeError, TypeError):
            pass
    return json_dict


def main(fileargs):
    outputfile = fileargs[len(fileargs)-1]
    inputfiles = fileargs[:len(fileargs)-1]
    print(outputfile)
    print(inputfiles)

    items = list()
    for f in inputfiles:
        newitems = json.load(open(f, 'r', encoding="utf-8"), object_hook=datetime_parser)
        items += newitems

    open(outputfile, 'wb').write(json.dumps(items, sort_keys=False, indent=4, ensure_ascii=False)
                              .encode('utf8'))



if __name__ == '__main__':
    if len(sys.argv) >= 3:
        main(sys.argv[1:])
    else:
        print("{}".format(__doc__))
