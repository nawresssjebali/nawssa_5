import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForgetMeComponent } from './forget-me.component';

describe('ForgetMeComponent', () => {
  let component: ForgetMeComponent;
  let fixture: ComponentFixture<ForgetMeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgetMeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForgetMeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
