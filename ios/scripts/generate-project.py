"""Generate a dependency-free Xcode project from the sources in this directory."""
import hashlib, json, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
objects = {}
def ident(name): return hashlib.sha256(name.encode()).hexdigest()[:24].upper()
def obj(identifier, isa, **fields):
    key = ident(identifier); objects[key] = {"isa":isa, **fields}; return key
def encode(value):
    if isinstance(value,dict): return "{\n" + "\n".join(f"{json.dumps(str(k))} = {encode(v)};" for k,v in value.items()) + "\n}"
    if isinstance(value,list): return "(" + ",".join(encode(v) for v in value) + ")"
    return json.dumps(str(value),ensure_ascii=False)
project_id, app_id = ident("Project"),ident("DSHRemote")
refs, groups = {}, []
for directory in ["DSHRemote","Tests"]:
    children = []
    for path in sorted((root/directory).iterdir()):
        if path.suffix not in [".swift",".xcassets",".xcprivacy",".plist",".entitlements"]: continue
        relative = path.relative_to(root).as_posix()
        types = {".swift":"sourcecode.swift",".xcassets":"folder.assetcatalog",".xcprivacy":"text.xml",".plist":"text.plist.xml",".entitlements":"text.plist.entitlements"}
        refs[relative] = obj(relative,"PBXFileReference",lastKnownFileType=types[path.suffix],path=relative,sourceTree="<group>")
        children.append(refs[relative])
    groups.append(obj(directory+" group","PBXGroup",children=children,name=directory,sourceTree="<group>"))
products=[]; targets=[]; target_attributes={}
common = {"SDKROOT":"iphoneos","IPHONEOS_DEPLOYMENT_TARGET":"16.0","SWIFT_VERSION":"5.0","CLANG_ENABLE_MODULES":"YES","TARGETED_DEVICE_FAMILY":"1,2","CODE_SIGN_STYLE":"Automatic","CURRENT_PROJECT_VERSION":"2","MARKETING_VERSION":"0.2.0"}
for name, kind, sources in [
    ("DSHRemote","application",[p for p in refs if p.startswith("DSHRemote/") and p.endswith(".swift")]),
    ("DSHRemoteTests","bundle.unit-test",["Tests/ModelTests.swift"]),
    ("DSHRemoteUITests","bundle.ui-testing",["Tests/iPadUITests.swift"])]:
    product=obj(name+" product","PBXFileReference",explicitFileType="wrapper.application" if kind=="application" else "wrapper.cfbundle",path=name+(".app" if kind=="application" else ".xctest"),sourceTree="BUILT_PRODUCTS_DIR")
    products.append(product)
    source_files=[obj(name+p,"PBXBuildFile",fileRef=refs[p]) for p in sources]
    source_phase=obj(name+" sources","PBXSourcesBuildPhase",buildActionMask="2147483647",files=source_files,runOnlyForDeploymentPostprocessing="0")
    resources=[]
    if kind=="application": resources=[obj("resource "+p,"PBXBuildFile",fileRef=refs[p]) for p in refs if p.endswith((".xcassets",".xcprivacy"))]
    resource_phase=obj(name+" resources","PBXResourcesBuildPhase",buildActionMask="2147483647",files=resources,runOnlyForDeploymentPostprocessing="0")
    frameworks=obj(name+" frameworks","PBXFrameworksBuildPhase",buildActionMask="2147483647",files=[],runOnlyForDeploymentPostprocessing="0")
    configs=[]
    for mode in ["Debug","Release"]:
        settings={**common,"PRODUCT_NAME":"$(TARGET_NAME)","PRODUCT_BUNDLE_IDENTIFIER":"com.dsh.remote"+("" if kind=="application" else "."+name)}
        settings.update({"SWIFT_OPTIMIZATION_LEVEL":"-Onone" if mode=="Debug" else "-O","DEBUG_INFORMATION_FORMAT":"dwarf" if mode=="Debug" else "dwarf-with-dsym"})
        if kind=="application":
            settings.update({"INFOPLIST_FILE":"DSHRemote/Info.plist","CODE_SIGN_ENTITLEMENTS":"DSHRemote/DSHRemote.entitlements","APS_ENVIRONMENT":"development" if mode=="Debug" else "production","ASSETCATALOG_COMPILER_APPICON_NAME":"AppIcon","ENABLE_TESTABILITY":"YES" if mode=="Debug" else "NO"})
        else:
            settings.update({"GENERATE_INFOPLIST_FILE":"YES","TEST_TARGET_NAME":"DSHRemote"})
            if kind=="bundle.unit-test": settings.update({"BUNDLE_LOADER":"$(TEST_HOST)","TEST_HOST":"$(BUILT_PRODUCTS_DIR)/DSHRemote.app/DSHRemote"})
        configs.append(obj(name+mode,"XCBuildConfiguration",name=mode,buildSettings=settings))
    configlist=obj(name+" configs","XCConfigurationList",buildConfigurations=configs,defaultConfigurationIsVisible="0",defaultConfigurationName="Release")
    dependencies=[]
    if kind!="application":
        proxy=obj(name+" proxy","PBXContainerItemProxy",containerPortal=project_id,proxyType="1",remoteGlobalIDString=app_id,remoteInfo="DSHRemote")
        dependencies=[obj(name+" dependency","PBXTargetDependency",target=app_id,targetProxy=proxy)]
        target_attributes[ident(name)]={"TestTargetID":app_id}
    targets.append(obj(name,"PBXNativeTarget",buildConfigurationList=configlist,buildPhases=[source_phase,frameworks,resource_phase],buildRules=[],dependencies=dependencies,name=name,productName=name,productReference=product,productType="com.apple.product-type."+kind))
productgroup=obj("Products","PBXGroup",children=products,name="Products",sourceTree="<group>")
maingroup=obj("Main","PBXGroup",children=groups+[productgroup],sourceTree="<group>")
projectconfigs=[obj("project"+mode,"XCBuildConfiguration",name=mode,buildSettings={"CLANG_ENABLE_OBJC_ARC":"YES","ENABLE_USER_SCRIPT_SANDBOXING":"YES"}) for mode in ["Debug","Release"]]
projectlist=obj("project configs","XCConfigurationList",buildConfigurations=projectconfigs,defaultConfigurationIsVisible="0",defaultConfigurationName="Release")
obj("Project","PBXProject",attributes={"LastUpgradeCheck":"1600","TargetAttributes":target_attributes},buildConfigurationList=projectlist,compatibilityVersion="Xcode 14.0",developmentRegion="zh-Hans",hasScannedForEncodings="0",knownRegions=["zh-Hans","en","Base"],mainGroup=maingroup,productRefGroup=productgroup,projectDirPath="",projectRoot="",targets=targets)
out=root/"DSHRemote.xcodeproj"
(out/"xcshareddata/xcschemes").mkdir(parents=True,exist_ok=True)
(out/"project.pbxproj").write_text("// !$*UTF8*$!\n"+encode({"archiveVersion":"1","classes":{},"objectVersion":"56","objects":objects,"rootObject":project_id})+"\n",encoding="utf-8")
def buildref(name):
    extension=".app" if name=="DSHRemote" else ".xctest"
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident(name)}" BuildableName="{name}{extension}" BlueprintName="{name}" ReferencedContainer="container:DSHRemote.xcodeproj"/>'
scheme=f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.7">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{buildref("DSHRemote")}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{buildref("DSHRemoteTests")}</TestableReference><TestableReference skipped="NO">{buildref("DSHRemoteUITests")}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{buildref("DSHRemote")}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"/>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''
(out/"xcshareddata/xcschemes/DSHRemote.xcscheme").write_text(scheme,encoding="utf-8")
print(out)