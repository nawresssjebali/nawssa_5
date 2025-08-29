import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingGuidelinesComponent } from './sharing-guidelines.component';

describe('SharingGuidelinesComponent', () => {
  let component: SharingGuidelinesComponent;
  let fixture: ComponentFixture<SharingGuidelinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingGuidelinesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharingGuidelinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
