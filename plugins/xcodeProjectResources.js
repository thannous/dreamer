// pbxproj quotes a region such as "pt-BR".
function pbxValue(value) {
  return /^[A-Za-z0-9_.]+$/.test(value) ? value : `"${value}"`;
}

function addKnownRegions(project, languages) {
  const { firstProject } = project.getFirstProject();
  const regions = firstProject.knownRegions ?? [];
  for (const language of languages) {
    if (!regions.some((region) => unquote(region) === language)) regions.push(pbxValue(language));
  }
  firstProject.knownRegions = regions;
}

function resourcesPhaseOf(project, targetKey) {
  const target = project.pbxNativeTargetSection()[targetKey];
  const phases = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
  const listed = target.buildPhases.find(({ value }) => phases[value]);
  if (listed) return phases[listed.value];
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetKey);
  return project.hash.project.objects.PBXResourcesBuildPhase[target.buildPhases.at(-1).value];
}

function unquote(value) {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : value;
}

module.exports = { addKnownRegions, pbxValue, resourcesPhaseOf, unquote };
