#!/usr/bin/env bash

dir=`mktemp -d`
echo "Temporary files in directory $dir"

# Ingest archived items
./movies_ingest.py  recursive /Volumes/video/arkiverat/Film $dir/video-arkiverat-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Dokumentär\ \&\ fakta $dir/video-dok-fakta-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Komedi $dir/video-komedi-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Kul $dir/video-kul-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Musik $dir/video-musik-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Reklam $dir/video-reklam-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Serie $dir/video-serie-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Tutorials $dir/video-tutorials-film.json
# pending ./movies_ingest.py  recursive /Volumes/video/arkiverat/Underhållning $dir/video-underhållning-film.json

# Ingest new items
./movies_ingest.py  recursive /Volumes/video/nytt/Film $dir/video-nytt-film.json

# Ingest disc based items
./movies_ingest.py  movielist ./movielist.txt $dir/movielist.json

# Concatenate all ingested data
./concat.py $dir/movielist.json $dir/video-arkiverat-film.json $dir/video-nytt-film.json allmovies.json

# Create a unified list of all items
./movies_report.py allmovies.json movielist "" > allmovies.txt

echo "Temporary files in directory $dir"