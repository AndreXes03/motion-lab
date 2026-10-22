// Copyright Andrea Salvo. Framevolve Free Use License (see repository LICENSE).
// Opened by LaunchServices: macOS owns approval of a downloaded unsigned app.
// This helper never removes quarantine or changes system security settings.
#import <Cocoa/Cocoa.h>

int main(void) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    NSBundle *bundle = NSBundle.mainBundle;
    NSURL *runtime = [bundle.resourceURL URLByAppendingPathComponent:@"runtime/framevolve-cycles"];
    NSTask *task = [[NSTask alloc] init];
    task.executableURL = runtime;
    task.arguments = @[@"--probe"];
    NSPipe *output = NSPipe.pipe;
    task.standardOutput = output;
    task.standardError = NSFileHandle.fileHandleWithNullDevice;
    NSError *error = nil;
    NSString *failure = nil;
    if (![task launchAndReturnError:&error]) failure = error.localizedDescription;
    NSDictionary *details = nil;
    if (!failure) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 20 * NSEC_PER_SEC), dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{ if (task.running) [task terminate]; });
      NSData *data = [output.fileHandleForReading readDataToEndOfFile];
      [task waitUntilExit];
      NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      for (NSString *line in [text componentsSeparatedByString:@"\n"]) {
        if ([line hasPrefix:@"MOTION_CYCLES "]) details = [NSJSONSerialization JSONObjectWithData:[[line substringFromIndex:14] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
      }
      if (task.terminationStatus != 0 || ![details[@"backend"] isEqual:@"cycles-standalone"] ||
          ![details[@"revision"] isEqual:[bundle objectForInfoDictionaryKey:@"FramevolveCyclesRevision"]] ||
          ![details[@"protocol"] isEqual:@1]) failure = @"The Cycles runtime self-check failed. Return to Framevolve to retry installation.";
    }
    if (!failure) {
      NSURL *receipt = [[bundle.bundleURL URLByDeletingLastPathComponent] URLByAppendingPathComponent:@"approval.json"];
      NSDictionary *approval = @{@"approved":@YES, @"protocol":@1, @"revision":details[@"revision"], @"approvedAt":[[NSISO8601DateFormatter new] stringFromDate:NSDate.date]};
      NSData *data = [NSJSONSerialization dataWithJSONObject:approval options:NSJSONWritingPrettyPrinted error:&error];
      if (!data || ![data writeToURL:receipt options:NSDataWritingAtomic error:&error]) failure = error.localizedDescription;
    }
    NSAlert *alert = [NSAlert new];
    alert.messageText = failure ? @"Rendering Cycles could not start" : @"Rendering Cycles is ready";
    alert.informativeText = failure ?: @"Return to Framevolve and click Check authorization. You can now use Cycles without Blender. This component does not need a separate Dock or Desktop icon.";
    [alert addButtonWithTitle:@"OK"];
    [NSApp activateIgnoringOtherApps:YES];
    [alert runModal];
    return failure ? 1 : 0;
  }
}
