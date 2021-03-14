#!/bin/bash
perl -pi -e "s/JoshPiper\/GModStore-Deployment\@([\w.]+)?/JoshPiper\/GModStore-Deployment\@$BUILD_TAG/g" README.md
