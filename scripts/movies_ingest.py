#!/usr/bin/env python3
"""Convert list of movies to JSON document.

Usage:

    python3 movielist_ingest.py inputtype inputfile outputfile

Args:
    inputtype:  
        movielist   Textfile with one movie on each line
        filelist    File with list of pathnames
        directory   Directory
        recursive   Directory, will traverse into subdirectories
    inoutfile:  Source data
    outputfile: JSON result
"""

import sys
import json
import unicodedata
import os


def fetch_items_movielist(filein):
    """Fetch movie items from a specially formatted text file.

    file = [ comment | movie ]*
    comment = # string
    movie = media_location TAB title_with_attributes
    title_with_attributes =  title TAB attributes
    attributes = *format | COMMA § category | COMMA # language | COMMA & on_mediaserver
    title = string [string SPACE]*
    language = audio SLASH subtitle
    on_mediaserver = & ms

    Args:
        filein: Input file

    Returns:
        A sequence of movie structures.
    """

    movies = list()
    with open(filein, 'r', encoding='utf-8') as f:
        for row in f:
            # comment
            if row[0] == "#":
                print("continue 1")
                continue

            # wanted
            if row.find("§wanted") > -1:
                print("continue 2")
                continue

            print(">" + row.strip("\n)"))

            # media_location, title, attributes
            tokens = row.split("\t")
            media_location = ""
            media_type = "disc"
            title = ""
            attributes = ""
            production_year = -1
            if len(tokens) >= 1:
                media_location = tokens[0].strip("\n")
            if len(tokens) >= 2:
                title = tokens[1].strip("\n")
                title_parts = title.split("(")
                if len(title_parts) == 2:
                    title = title_parts[0].strip()
                    production_year = title_parts[1].split(")")[0]
                    if production_year.find("/") >= 0:
                        print("Error: Illegal production year in {}".format(row))
                        continue
                elif len(title_parts) > 2:
                    print("Error: Too many title parts in {}".format(row))
                    continue
            if len(tokens) >= 3:
                attributes = tokens[2].strip("\n")
            print("media_location=[{}], title=[{}], production_year={}, attributes=[{}]".format(
                media_location, title, production_year, attributes))

            # attributes
            attr = attributes.split(",")
            media = ""
            if len(attributes) == 0 and title != "---":
                media = "AttributeError"
            if len(attributes) > 0 and attributes[0] == " ":
                media = "AttributeError"
            language_spoken = ""
            language_subtitle = ""
            category = []
            onmediaserver = False
            comment = ""
            for i in attr:
                # print("<<{}>>".format(i))
                i = i.strip(" \n")
                if len(i) == 0:
                    continue
                if i.find("*") == 0:
                    media = i.strip("*")
                if i.find("#") == 0:
                    languages = i.strip("#").split("/")
                    language_spoken = languages[0]
                    if len(languages) >= 2:
                        language_subtitle = languages[1]
                if i.find("§") == 0:
                    category.append(i.strip("§"))
                if i.find("&ms") == 0:
                    onmediaserver = True
                if i.find("/") == 0:
                    comment = i.strip("/")

            print("\tmedia=[{}], spoken=[{}], subtitle=[{}], cat={}, ms=[{}], comment=[{}]".format(
                media, language_spoken, language_subtitle, category, onmediaserver, comment))

            movie = {"title": title, "media-location": media_location,
                     "media-type": media_type, "media-format": media,
                     "audio": language_spoken, "subtitle": language_subtitle,
                     "category": category, "comment": comment,
                     "production-year": production_year}


            movies.append(movie)
    return movies

def get_movie_from_row(row):
    """Convert a line of text to a movie item

    row = path / basename . extension
    path = ???
    basename = title [ LP productionyear RP ] [ LP language RP ] [ LP copy RP ]
    language = audio | swesub |  (audio COMMA swesub)
    productionyear = INTEGER
    audio = STRING
    copy = copy # Item is copied from disc
    extension = container
    container = mp4 | avi

    Args:
        row:    The line of text to convert.

    Returns:
        A movie item.
    """

    print("\n>" + row.strip("\n)"))
    row = unicodedata.normalize('NFC', row)
    print("\n>" + row.strip("\n)"))

    # Strip off pathname component(s)
    filecomponents = row.strip("\n").split("/")
    filename = filecomponents[len(filecomponents) - 1]
    print("filename={}".format(filename))

    # Skip files with inbedded "."
    filecomps = filename.split(".")
    if len(filecomps) != 2:
        raise ValueError("ERROR: filename not a file.extension: {}".format(row))

    # Skip subtitles
    basename = filecomps[0]
    filetype = filecomps[1]
    if filetype == "sub" or filetype == "idx":
        raise ValueError("SKIP subtitle: {}".format(row))

    # Default values
    title = ""
    media_location = "ms"
    copy = False
    productionyear = 0
    audio = "?"
    subtitle = "?"
    category = []
    comments = ""

    print("basename={}".format(basename))

    # Split at "(":
    attr = basename.split("(")

    # Extract moviename
    if attr[0] == "":
        raise ValueError("ERROR: No movietitle: {}".format(row))

    title = attr[0].strip(" ")
    # Convert to UTF-8
    # ...

    attr = attr[1:]

    for i in attr:
        print("attribute=[{}]".format(i))
        i = i.strip(" ")
        if i[len(i) - 1] != ")":
            raise ValueError("ERROR: Data after ): {}".format(row))
        i = i.strip(")")
        lang = i.split(",")

        if len(i) == 0:
            raise ValueError("ERROR: Empty attribute: {}".format(row))

    #   If a number => productionyear
        elif i.isdigit():
            if productionyear != 0:
                raise ValueError("ERROR: duplicate productionyear: {}".format(row))
            productionyear = int(i)

    #   If "copy" => copy
        elif i == "copy":
            copy = True

    #   Else language:
    #       Split at ","

        elif len(lang) == 1:
            #       If one item:
            #           audio or "swesub"
            if lang[0] == "swesub":
                subtitle = "se"
            else:
                audio = lang[0]

    #       If two items:
        elif len(lang) == 2:
            #               audio, subtitle or "swesub"
            audio = lang[0]
            if lang[1] == "swesub":
                subtitle = "se"
            else:
                subtitle = lang[1]

    print("\ttitle={}, filetype={}, media_location={}, copy={}, productionyear={}, audio={}, subtitle={}"
          .format(title, filetype, media_location, copy, productionyear, audio, subtitle))

    movie = {"title": title, "media-location": media_location,
             "media-type": "file", "media-format": filetype,
             "audio": audio, "subtitle": subtitle,
             "production-year": productionyear, "category": category, "comments": comments}

    return movie


def fetch_items_filelist(filelist):
    """Fetch movie items from a list of filenames.

    filelist = movie*

    Args:
        filelist: Input file

    Returns:
        A sequence of movie structures.
    """
    movies = list()

    with open(filelist, 'r', encoding='utf-8') as file:
        for row in file:
            try:
                movie = get_movie_from_row(row)
                movies.append(movie)
            except ValueError as ex:
                print(ex)
    return movies


def fetch_items_directory(directory):
    """Fetch movie items from a directory.

    directory = path

    Args:
        directory: Input directory

    Returns:
        A sequence of movie structures.
    """
    movies = list()
    filelist = os.listdir(directory)

    for row in filelist:
        try:
            file = "{}/{}".format(directory, row)
            print("file={}".format(file))
            if os.path.isfile(file):
                movie = get_movie_from_row(row)
                movies.append(movie)
        except ValueError as ex:
            print(ex)

    return movies


def fetch_items_directory_recursive(directory):
    """Fetch movie items from a directory.

    directory = path

    Args:
        directory: Input directory

    Returns:
        A sequence of movie structures.
    """
    movies = list()
    filelist = [os.path.join(dp, f)
                for dp, dn, fn in os.walk(os.path.expanduser(directory)) for f in fn]

    for row in filelist:
        try:
            movie = get_movie_from_row(row)
            movies.append(movie)
        except ValueError as ex:
            print(ex)

    return movies


def main(filetype, filein, fileout):
    """Dispatch the correct parser and write output encoded as JSON document.
    """
    items = list()

    if filetype == "movielist":
        items = fetch_items_movielist(filein)
    elif filetype == "filelist":
        items = fetch_items_filelist(filein)
    elif filetype == "directory":
        items = fetch_items_directory(filein)
    elif filetype == "recursive":
        items = fetch_items_directory_recursive(filein)
    else:
        print("{}".format(__doc__))
        return

    open(fileout, 'wb').write(json.dumps(items, sort_keys=False, indent=4, ensure_ascii=False)
                              .encode('utf8'))


if __name__ == "__main__":
    if len(sys.argv) == 4:
        main(sys.argv[1], sys.argv[2], sys.argv[3])
    else:
        print("{}".format(__doc__))
