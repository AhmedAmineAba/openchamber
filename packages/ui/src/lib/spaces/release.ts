// Whether the isolated-spaces feature is released to users: the switch's row in Settings, its
// search entries and the "Isolated spaces" page show only while this is true. It stayed false
// while the feature was built behind its switch, so releases that shipped meanwhile carried no
// entry point (decision 17 in packages/web/server/lib/spaces/DOCUMENTATION.md); the
// `isolatedSpacesEnabled` key in settings.json worked for the people building it all along.
export const ISOLATED_SPACES_RELEASED = true;
