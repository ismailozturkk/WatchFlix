Pod::Spec.new do |s|
  s.name           = 'ReminderWidget'
  s.version        = '1.0.0'
  s.summary        = 'Watchify hatırlatıcı verisini iOS WidgetKit widget’ına köprüler.'
  s.description    = 'Paylaşılan App Group UserDefaults’a yazıp WidgetKit zaman çizelgelerini yenileyen yerel Expo modülü.'
  s.author         = 'Watchify'
  s.homepage       = 'https://github.com/smlztrk/watchify'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
