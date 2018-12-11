#!/bin/bash
echo "Creating temporary test location..."
HOME=$(pwd)
TMPDIR=$(mktemp -d -t json-link-test)
cd $TMPDIR
echo "Initializing test repo..."
git init --bare test-repo.git
echo "Cloning test repo..."
git clone test-repo.git
echo "Populating version 1 of test data"
cp -R $HOME/json-v1/* test-repo/
cd test-repo
git add -A .
git commit -m "Commit 1"
git push origin master
git tag -a "v1" -m "Version 1"
git push origin "v1"
echo "Populating version 2 of test data"
cd ..
cp -R $HOME/json-v2/* test-repo
cd test-repo
git add -A .
git commit -m "Commit 2"
git push origin master
git tag -a "v2" -m "Version 2"
git push origin "v2"
cd ..
echo "Testing against bare repo"
echo "  Testing v1..."
export TEST_VERSION="v1"
$HOME/../bin/json-link test-repo.git/main.json git > result1.json
#diff result-v1.json result.json
# TODO report differences
export TEST_VERSION="v2"
echo "  Testing v2..."
$HOME/../bin/json-link test-repo.git/main.json git > result2.json
#diff result-v2.json result.json
# TODO report differences
echo "Testing against cloned repo"
echo "  Testing v1..."
export TEST_VERSION="v1"
$HOME/../bin/json-link test-repo/main.json git > result3.json
#diff result-v1.json result.json
# TODO report differences
export TEST_VERSION="v2"
echo "  Testing v2..."
$HOME/../bin/json-link test-repo/main.json git > result4.json
#diff result-v2.json result.json
# TODO report differences

# TODO Tidy up
echo $TMPDIR
#rm -Rf $TMPDIR
