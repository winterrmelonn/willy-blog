// node --test lib/followback.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, kindOf, parseExport } from "./followback.ts";

test("reads both export shapes and compares them", () => {
    const followers = parseExport("followers_1.json", JSON.stringify([
        { string_list_data: [{ href: "https://www.instagram.com/Alice", value: "Alice", timestamp: 5 }] },
        { string_list_data: [{ href: "https://www.instagram.com/bob", value: "bob", timestamp: 6 }] },
    ]));
    const following = parseExport("following.json", JSON.stringify({ relationships_following: [
        { title: "bob", string_list_data: [{ href: "https://www.instagram.com/_u/bob", timestamp: 7 }] },
        { title: "", string_list_data: [{ href: "https://www.instagram.com/_u/carol", timestamp: 8 }] },
    ] }));
    assert.deepEqual([...followers.keys()], ["alice", "bob"]);
    assert.deepEqual([...following.keys()], ["bob", "carol"]);

    const r = compare(followers, following, { date: 1, followers: ["alice", "bob", "dave"] });
    assert.deepEqual(r.notBack, [["carol", 8]]);
    assert.deepEqual(r.fans, [["alice", 5]]);
    assert.deepEqual(r.lost, [["dave", 0]]);
    assert.deepEqual(r.gained, []);
    assert.equal(r.mutual, 1);
    assert.equal(compare(followers, following, null).lost, null);
});

test("picks out the right files", () => {
    assert.equal(kindOf("export/connections/followers_and_following/followers_2.json"), "followers");
    assert.equal(kindOf("following.html"), "following");
    assert.equal(kindOf("following_hashtags.json"), null);
});
